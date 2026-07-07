/*
 * ptrace-inject.c — si aggancia (ptrace) al processo BtClass100 e inietta
 * eventi tastiera sintetici direttamente nelle sue syscall read/poll/ppoll,
 * SENZA passare da /dev/input/eventN — bypassa il limite del preload
 * (Qt chiama queste syscall direttamente, non tramite i simboli di libreria
 * poll()/ppoll()/read() che un LD_PRELOAD potrebbe intercettare).
 *
 * Logica:
 * - poll()/ppoll(): se l'array include uno dei device osservati e il nostro
 *   canale laterale ha dati pronti (controllato SENZA consumarli), forziamo
 *   POLLIN su quell'entry all'uscita della syscall.
 * - read(): se il fd e' uno di quelli osservati, all'ENTRATA neutralizziamo
 *   la syscall reale (la trasformiamo in una getpid() innocua) SOLO se
 *   abbiamo dati sintetici pronti; all'USCITA scriviamo i byte veri nel
 *   buffer del processo tracciato e correggiamo il valore di ritorno.
 *   Se non ci sono dati sintetici, la read reale passa invariata: l'input
 *   fisico continua a funzionare esattamente come sempre.
 *
 * IMPORTANTE: consegna un solo evento (16 byte) per lettura, come fa il
 * device kernel reale — consegnarne di piu' in un colpo solo ha causato un
 * crash del processo Qt durante i test (comportamento osservato, non
 * pienamente compreso a livello di causa — vedi CHANGELOG/README per i
 * dettagli sul livello di rischio di questo strumento).
 *
 * Uso: ./ptrace-inject <pid> [fd_a] [fd_b]
 * (fd_a/fd_b vanno confermati ad ogni sessione con /proc/PID/fd, possono
 * cambiare da un riavvio di Qt all'altro — il controller li scopre da solo)
 *
 * Compilazione (cross, staticamente linkato per evitare ogni dipendenza
 * dalla versione di glibc del target):
 *   arm-linux-gnueabihf-gcc -O2 -static -o ptrace-inject-armhf ptrace-inject.c
 */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <errno.h>
#include <sys/ptrace.h>
#include <sys/wait.h>
#include <sys/user.h>
#include <sys/syscall.h>
#include <sys/types.h>

#define SIDE_CHANNEL_PATH "/tmp/c100x-input-side"

static pid_t g_pid = -1;
static volatile sig_atomic_t g_should_exit = 0;

static void on_signal(int sig) {
    (void)sig;
    g_should_exit = 1;
}

static int watch_a = 11, watch_b = 12;
static int is_watched(int fd) { return fd == watch_a || fd == watch_b; }

static int side_fd = -1;
static void ensure_side_channel(void) {
    if (side_fd >= 0) return;
    side_fd = open(SIDE_CHANNEL_PATH, O_RDONLY | O_NONBLOCK);
}

/* Controlla se ci sono dati pronti SENZA consumarli (poll sul canale stesso). */
static int side_channel_peek(void) {
    ensure_side_channel();
    if (side_fd < 0) return 0;
    struct pollfd pfd; pfd.fd = side_fd; pfd.events = POLLIN; pfd.revents = 0;
    int r = poll(&pfd, 1, 0);
    return r > 0 && (pfd.revents & POLLIN);
}

/* Consuma davvero i dati, MA al massimo un evento (16 byte) alla volta —
   il device kernel reale consegna un input_event per read(), e Qt potrebbe
   fare assunzioni su questo; se gliene diamo di piu' in un colpo solo
   rischiamo di confondere il suo parser (osservato: causava un crash). */
static ssize_t side_channel_take(void *buf, size_t maxlen) {
    ensure_side_channel();
    if (side_fd < 0) return 0;
    size_t want = maxlen < 16 ? maxlen : 16;
    ssize_t n = read(side_fd, buf, want);
    return n > 0 ? n : 0;
}

static int mem_fd = -1;
static ssize_t mem_read(unsigned long addr, void *buf, size_t len) { return pread(mem_fd, buf, len, (off_t)addr); }
static ssize_t mem_write(unsigned long addr, const void *buf, size_t len) { return pwrite(mem_fd, buf, len, (off_t)addr); }

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "Uso: %s <pid> [fd_a] [fd_b]\n", argv[0]); return 1; }
    pid_t pid = (pid_t)atoi(argv[1]);
    g_pid = pid;
    signal(SIGTERM, on_signal);
    signal(SIGINT, on_signal);
    if (argc >= 3) watch_a = atoi(argv[2]);
    if (argc >= 4) watch_b = atoi(argv[3]);

    printf("Aggancio al PID %d, fd tastiera: %d,%d\n", pid, watch_a, watch_b);
    fflush(stdout);

    if (ptrace(PTRACE_ATTACH, pid, 0, 0) != 0) { perror("PTRACE_ATTACH"); return 1; }
    int status;
    waitpid(pid, &status, 0);

    char mem_path[64];
    snprintf(mem_path, sizeof(mem_path), "/proc/%d/mem", pid);
    mem_fd = open(mem_path, O_RDWR);
    if (mem_fd < 0) { perror("open /proc/pid/mem (serve essere root)"); ptrace(PTRACE_DETACH, pid, 0, 0); return 1; }

    ensure_side_channel();
    printf("Pronto. In ascolto...\n");
    fflush(stdout);

    int in_syscall = 0;
    long pending_nr = -1;
    unsigned long pending_fd = 0, pending_buf = 0, pending_count = 0;
    int neutralized = 0;
    unsigned char synth_bytes[512];
    size_t synth_len = 0;

    unsigned long pending_poll_fds_addr = 0;
    unsigned long pending_poll_nfds = 0;
    int pending_poll_active = 0;

    for (;;) {
        if (g_should_exit) { printf("Segnale ricevuto, mi stacco...\n"); fflush(stdout); break; }
        if (ptrace(PTRACE_SYSCALL, pid, 0, 0) != 0) { perror("PTRACE_SYSCALL"); break; }
        if (waitpid(pid, &status, 0) < 0) {
            if (errno == EINTR) continue;
            perror("waitpid"); break;
        }
        if (WIFEXITED(status) || WIFSIGNALED(status)) { printf("Processo tracciato terminato.\n"); break; }
        if (!WIFSTOPPED(status)) continue;

        struct user_regs regs;
        if (ptrace(PTRACE_GETREGS, pid, 0, &regs) != 0) { perror("GETREGS"); break; }

        if (!in_syscall) {
            /* ENTRATA */
            long nr = (long)regs.uregs[7];
            pending_nr = nr;
            neutralized = 0;
            pending_poll_active = 0;

            if (nr == SYS_read) {
                pending_fd = regs.uregs[0];
                pending_buf = regs.uregs[1];
                pending_count = regs.uregs[2];
                if (is_watched((int)pending_fd)) {
                    synth_len = side_channel_take(synth_bytes, sizeof(synth_bytes));
                    if (synth_len > 0) {
                        if (synth_len > pending_count) synth_len = pending_count;
                        regs.uregs[7] = SYS_getpid; /* neutralizza: niente vera read sul device */
                        ptrace(PTRACE_SETREGS, pid, 0, &regs);
                        neutralized = 1;
                        printf("[inject] read(fd=%lu) neutralizzata, servo %zu byte sintetici\n", pending_fd, synth_len);
                        fflush(stdout);
                    }
                }
            } else if (nr == SYS_poll || nr == SYS_ppoll) {
                pending_poll_fds_addr = regs.uregs[0];
                pending_poll_nfds = regs.uregs[1];
                pending_poll_active = 1;
            }
        } else {
            /* USCITA */
            if (pending_nr == SYS_read && neutralized) {
                mem_write(pending_buf, synth_bytes, synth_len);
                regs.uregs[0] = (unsigned long)synth_len;
                ptrace(PTRACE_SETREGS, pid, 0, &regs);
                printf("[inject] scritti %zu byte sintetici nel buffer del processo\n", synth_len);
                fflush(stdout);
            } else if (pending_poll_active) {
                long ret = (long)regs.uregs[0];
                if (ret >= 0 && pending_poll_nfds > 0 && pending_poll_nfds <= 32 && side_channel_peek()) {
                    unsigned char buf[32 * 8];
                    size_t total = pending_poll_nfds * 8;
                    if (mem_read(pending_poll_fds_addr, buf, total) == (ssize_t)total) {
                        int changed = 0;
                        unsigned long i;
                        for (i = 0; i < pending_poll_nfds; i++) {
                            int fd; short events, revents;
                            memcpy(&fd, buf + i * 8, 4);
                            memcpy(&events, buf + i * 8 + 4, 2);
                            memcpy(&revents, buf + i * 8 + 6, 2);
                            if (is_watched(fd) && (events & POLLIN) && !(revents & POLLIN)) {
                                revents = (short)(revents | POLLIN);
                                memcpy(buf + i * 8 + 6, &revents, 2);
                                changed = 1;
                            }
                        }
                        if (changed) {
                            mem_write(pending_poll_fds_addr, buf, total);
                            regs.uregs[0] = (unsigned long)(ret + 1);
                            ptrace(PTRACE_SETREGS, pid, 0, &regs);
                        }
                    }
                }
            }
        }

        in_syscall = !in_syscall;
    }

    ptrace(PTRACE_DETACH, pid, 0, 0);
    return 0;
}
