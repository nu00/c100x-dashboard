/*
 * fb-blit.c — legge fotogrammi grezzi BGRA (32bpp) da stdin, uno via l'altro
 * senza separatori, e li scrive nel rettangolo (x,y,w,h) scelto di un
 * framebuffer Linux (es. /dev/fb0), lasciando intatto tutto il resto dello
 * schermo — non tocca mai i pixel fuori da quel rettangolo.
 *
 * Pensato per essere alimentato da ffmpeg via pipe, es.:
 *   ffmpeg -i <url> -vf scale=W:H,format=bgra -f rawvideo -an - | \
 *     ./fb-blit /dev/fb0 X Y W H
 *
 * Usa gli ioctl standard FBIOGET_*SCREENINFO per leggere davvero
 * stride/bpp del framebuffer, invece di assumerli — piu' robusto.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/ioctl.h>
#include <linux/fb.h>

int main(int argc, char **argv) {
    if (argc != 6) {
        fprintf(stderr, "uso: %s <device fb> <x> <y> <w> <h>\n", argv[0]);
        return 1;
    }
    const char *dev = argv[1];
    int x = atoi(argv[2]);
    int y = atoi(argv[3]);
    int w = atoi(argv[4]);
    int h = atoi(argv[5]);

    int fd = open(dev, O_RDWR);
    if (fd < 0) { perror("open framebuffer"); return 1; }

    struct fb_var_screeninfo vinfo;
    struct fb_fix_screeninfo finfo;
    if (ioctl(fd, FBIOGET_VSCREENINFO, &vinfo) < 0) { perror("FBIOGET_VSCREENINFO"); return 1; }
    if (ioctl(fd, FBIOGET_FSCREENINFO, &finfo) < 0) { perror("FBIOGET_FSCREENINFO"); return 1; }

    int fb_bpp = vinfo.bits_per_pixel;
    if (fb_bpp != 32) {
        fprintf(stderr, "atteso framebuffer a 32bpp, trovato %dbpp — questo programma non gestisce altri formati\n", fb_bpp);
        return 1;
    }
    long stride = finfo.line_length;
    long fb_size = (long)finfo.smem_len;

    if (x < 0 || y < 0 || w <= 0 || h <= 0 ||
        (unsigned)(x + w) > vinfo.xres || (unsigned)(y + h) > vinfo.yres) {
        fprintf(stderr, "rettangolo (%d,%d,%d,%d) fuori dai limiti del framebuffer (%dx%d)\n",
                x, y, w, h, vinfo.xres, vinfo.yres);
        return 1;
    }

    unsigned char *fbmem = mmap(NULL, fb_size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (fbmem == MAP_FAILED) { perror("mmap framebuffer"); return 1; }

    long frame_bytes = (long)w * h * 4; // BGRA, 4 byte a pixel
    unsigned char *frame = malloc(frame_bytes);
    if (!frame) { fprintf(stderr, "malloc fallita\n"); return 1; }

    fprintf(stderr, "fb-blit: %s %dx%d bpp=%d stride=%ld — disegno in (%d,%d) %dx%d\n",
            dev, vinfo.xres, vinfo.yres, fb_bpp, stride, x, y, w, h);

    for (;;) {
        long got = 0;
        while (got < frame_bytes) {
            ssize_t n = read(0, frame + got, frame_bytes - got);
            if (n <= 0) {
                fprintf(stderr, "fb-blit: stdin chiuso o errore di lettura, esco.\n");
                return 0;
            }
            got += n;
        }
        // Copia riga per riga, rispettando lo stride del framebuffer (che puo'
        // essere piu' largo della nostra finestra) — mai scrivere fuori dal
        // rettangolo assegnato.
        for (int row = 0; row < h; row++) {
            long dst_off = (long)(y + row) * stride + (long)x * 4;
            long src_off = (long)row * w * 4;
            memcpy(fbmem + dst_off, frame + src_off, (long)w * 4);
        }
    }

    return 0;
}
