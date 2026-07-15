/*
 * vpu-fb-decode.c — legge H.264 Annex-B (con AUD) da stdin, lo decodifica
 * con l'hardware VPU reale tramite libimxvpuapi (bypassando GStreamer e il
 * suo bug noto di riporto latenza per sorgenti live), converte da I420 a
 * BGRA con scala al volo, e scrive nel rettangolo (x,y,w,h) scelto di un
 * framebuffer — lasciando intatto tutto il resto dello schermo.
 *
 * Basato sull'esempio ufficiale Freescale/libimxvpuapi (decode-example.c),
 * stessa licenza LGPL 2.1+. Pensato per essere alimentato da ffmpeg via pipe:
 *   ffmpeg -i <url> -c:v copy -bsf:v h264_mp4toannexb,h264_metadata=aud=insert -f h264 - | \
 *     ./vpu-fb-decode /dev/fb0 X Y W H
 */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdarg.h>
#include <time.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/ioctl.h>
#include <linux/fb.h>

#include "imxvpuapi.h"
#include "h264_utils.h"
#include <signal.h>

static volatile sig_atomic_t g_should_stop = 0;
static void on_stop_signal(int sig) { (void)sig; g_should_stop = 1; }

typedef struct {
    h264_context h264_ctx;

    ImxVpuDecoder *vpudec;
    ImxVpuDMABuffer *bitstream_buffer;

    ImxVpuDecInitialInfo initial_info;
    ImxVpuFramebuffer *framebuffers;
    ImxVpuDMABuffer **fb_dmabuffers;
    unsigned int num_framebuffers;
    ImxVpuFramebufferSizes calculated_sizes;

    unsigned int frame_id_counter;
    ImxVpuDecOpenParams open_params;

    /* framebuffer di destinazione (schermo) */
    unsigned char *fbmem;
    long fb_stride;
    int dst_x, dst_y, dst_w, dst_h;

    /* Tabelle di mappatura scala precalcolate (una divisione a pixel era il
     * vero collo di bottiglia su questa CPU — vedi ottimizzazione blit) */
    int *sx_table, *sy_table;
    int table_src_w, table_src_h;
} Context;

static void logging_fn(ImxVpuLogLevel level, char const *file, int const line, char const *fn, const char *format, ...) {
    va_list args;
    fprintf(stderr, "%s:%d (%s): ", file, line, fn);
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    fprintf(stderr, "\n");
    (void)level;
}

static int initial_info_callback(ImxVpuDecoder *decoder, ImxVpuDecInitialInfo *new_initial_info, unsigned int output_code, void *user_data) {
    unsigned int i;
    Context *ctx = (Context *)user_data;
    (void)decoder; (void)output_code;

    ctx->initial_info = *new_initial_info;
    fprintf(stderr, "vpu-fb-decode: dimensione sorgente %ux%u, framebuffer minimi richiesti %u\n",
            ctx->initial_info.frame_width, ctx->initial_info.frame_height, ctx->initial_info.min_num_required_framebuffers);

    imx_vpu_calc_framebuffer_sizes(
        ctx->initial_info.color_format,
        ctx->initial_info.frame_width, ctx->initial_info.frame_height,
        ctx->initial_info.framebuffer_alignment, ctx->initial_info.interlacing, 0,
        &(ctx->calculated_sizes)
    );

    if (ctx->framebuffers != NULL) free(ctx->framebuffers);
    if (ctx->fb_dmabuffers != NULL) {
        for (i = 0; i < ctx->num_framebuffers; ++i) imx_vpu_dma_buffer_deallocate(ctx->fb_dmabuffers[i]);
        free(ctx->fb_dmabuffers);
    }

    ctx->num_framebuffers = ctx->initial_info.min_num_required_framebuffers;
    ctx->framebuffers = malloc(sizeof(ImxVpuFramebuffer) * ctx->num_framebuffers);
    ctx->fb_dmabuffers = malloc(sizeof(ImxVpuDMABuffer*) * ctx->num_framebuffers);

    for (i = 0; i < ctx->num_framebuffers; ++i) {
        ctx->fb_dmabuffers[i] = imx_vpu_dma_buffer_allocate(
            imx_vpu_dec_get_default_allocator(), ctx->calculated_sizes.total_size,
            ctx->initial_info.framebuffer_alignment, 0
        );
        imx_vpu_fill_framebuffer_params(&(ctx->framebuffers[i]), &(ctx->calculated_sizes), ctx->fb_dmabuffers[i], (void*)((uintptr_t)(0x2000 + i)));
    }

    imx_vpu_dec_register_framebuffers(ctx->vpudec, ctx->framebuffers, ctx->num_framebuffers);
    return 1;
}

/* Converte un fotogramma I420 (planare, con eventuale stride diverso dalla
 * larghezza) in BGRA, scalando (nearest-neighbour: sufficiente ed economico
 * per queste dimensioni) direttamente nel rettangolo di destinazione del
 * framebuffer scelto — senza toccare il resto dello schermo.
 *
 * Le mappature sx/sy (quale pixel/riga sorgente corrisponde a ciascun
 * pixel/riga di destinazione) sono precalcolate una sola volta in tabelle,
 * non ricalcolate ad ogni pixel — la divisione intera per pixel era il vero
 * collo di bottiglia su questa CPU (~130000 divisioni a fotogramma). */
static void ensure_scale_tables(Context *ctx, int src_w, int src_h) {
    if (ctx->sx_table && ctx->table_src_w == src_w && ctx->table_src_h == src_h) return;
    free(ctx->sx_table); free(ctx->sy_table);
    ctx->sx_table = malloc(sizeof(int) * ctx->dst_w);
    ctx->sy_table = malloc(sizeof(int) * ctx->dst_h);
    for (int dx = 0; dx < ctx->dst_w; dx++) ctx->sx_table[dx] = dx * src_w / ctx->dst_w;
    for (int dy = 0; dy < ctx->dst_h; dy++) ctx->sy_table[dy] = dy * src_h / ctx->dst_h;
    ctx->table_src_w = src_w; ctx->table_src_h = src_h;
}

/* Tabelle di conversione colore precalcolate una sola volta all'avvio: niente
 * piu' moltiplicazioni ne' confronti min/max nel ciclo interno per pixel —
 * solo letture da tabella. Era il vero collo di bottiglia a piena risoluzione
 * (300-700ms a fotogramma per 800x480, abbastanza da far scattare il
 * watchdog hardware del citofono e farlo riavviare da solo). */
static int g_tables_ready = 0;
static int R_FROM_V[256], G_FROM_U[256], G_FROM_V[256], B_FROM_U[256];
static unsigned char CLAMP_TABLE[1024]; /* indice = valore + 256 */

static void ensure_color_tables(void) {
    if (g_tables_ready) return;
    for (int i = 0; i < 256; i++) {
        int v = i - 128, u = i - 128;
        R_FROM_V[i] = (91881 * v) >> 16;
        G_FROM_U[i] = (22554 * u) >> 16;
        G_FROM_V[i] = (46802 * v) >> 16;
        B_FROM_U[i] = (116130 * u) >> 16;
    }
    for (int i = 0; i < 1024; i++) {
        int v = i - 256;
        CLAMP_TABLE[i] = (unsigned char)(v < 0 ? 0 : (v > 255 ? 255 : v));
    }
    g_tables_ready = 1;
}

static void blit_i420_scaled(Context *ctx, const uint8_t *y_plane, const uint8_t *u_plane, const uint8_t *v_plane,
                              int y_stride, int cbcr_stride, int src_w, int src_h) {
    ensure_scale_tables(ctx, src_w, src_h);
    ensure_color_tables();

    for (int dy = 0; dy < ctx->dst_h; dy++) {
        int sy = ctx->sy_table[dy];
        const uint8_t *y_row = y_plane + (size_t)sy * y_stride;
        const uint8_t *u_row = u_plane + (size_t)(sy / 2) * cbcr_stride;
        const uint8_t *v_row = v_plane + (size_t)(sy / 2) * cbcr_stride;
        unsigned char *dst_row = ctx->fbmem + (size_t)(ctx->dst_y + dy) * ctx->fb_stride + (size_t)ctx->dst_x * 4;

        for (int dx = 0; dx < ctx->dst_w; dx++) {
            int sx = ctx->sx_table[dx];
            int Y = y_row[sx];
            int u = u_row[sx >> 1];
            int v = v_row[sx >> 1];

            unsigned char r = CLAMP_TABLE[Y + R_FROM_V[v] + 256];
            unsigned char g = CLAMP_TABLE[Y - G_FROM_U[u] - G_FROM_V[v] + 256];
            unsigned char b = CLAMP_TABLE[Y + B_FROM_U[u] + 256];

            /* Una sola scrittura a 32 bit invece di 4 scritture separate a
             * byte — la memoria del framebuffer e' tipicamente non cacheata,
             * ogni scrittura individuale puo' essere una transazione lenta a
             * se' stante. BGRA in memoria (little-endian) = 0xAARRGGBB nel
             * registro. */
            uint32_t *px32 = (uint32_t *)(dst_row + (size_t)dx * 4);
            *px32 = (0xFFu << 24) | ((uint32_t)r << 16) | ((uint32_t)g << 8) | (uint32_t)b;
        }
    }
}

/* Riempie di nero il rettangolo di destinazione — chiamata a fine stream
 * (uscita pulita, errore, o segnale di stop) per non lasciare l'ultimo
 * fotogramma congelato a schermo dopo che ci siamo fermati. */
static void clear_rect(Context *ctx) {
    for (int dy = 0; dy < ctx->dst_h; dy++) {
        unsigned char *dst_row = ctx->fbmem + (size_t)(ctx->dst_y + dy) * ctx->fb_stride + (size_t)ctx->dst_x * 4;
        for (int dx = 0; dx < ctx->dst_w; dx++) {
            uint32_t *px32 = (uint32_t *)(dst_row + (size_t)dx * 4);
            *px32 = (0xFFu << 24); /* nero opaco */
        }
    }
}

static long ms_since(struct timespec *t0) {
    struct timespec t1;
    clock_gettime(CLOCK_MONOTONIC, &t1);
    return (t1.tv_sec - t0->tv_sec) * 1000 + (t1.tv_nsec - t0->tv_nsec) / 1000000;
}

static int decode_one(Context *ctx) {
    ImxVpuEncodedFrame encoded_frame;
    unsigned int output_code;
    ImxVpuDecReturnCodes ret;
    int ok;
    struct timespec t0;
    long read_ms, decode_ms, blit_ms = 0;

    clock_gettime(CLOCK_MONOTONIC, &t0);
    if (imx_vpu_dec_is_drain_mode_enabled(ctx->vpudec)) {
        encoded_frame.data = NULL; encoded_frame.data_size = 0; encoded_frame.context = NULL;
        imx_vpu_dec_set_codec_data(ctx->vpudec, NULL, 0);
        ok = 1;
    } else {
        ok = h264_ctx_read_access_unit(&(ctx->h264_ctx));
        if (ctx->h264_ctx.au_end_offset <= ctx->h264_ctx.au_start_offset) return -1; /* EOS */
        encoded_frame.data = ctx->h264_ctx.in_buffer + ctx->h264_ctx.au_start_offset;
        encoded_frame.data_size = ctx->h264_ctx.au_end_offset - ctx->h264_ctx.au_start_offset;
        imx_vpu_dec_set_codec_data(ctx->vpudec, NULL, 0);
        encoded_frame.context = (void *)((uintptr_t)(ctx->frame_id_counter));
        encoded_frame.pts = 0; encoded_frame.dts = 0;
    }
    read_ms = ms_since(&t0);

    struct timespec t1;
    clock_gettime(CLOCK_MONOTONIC, &t1);
    if ((ret = imx_vpu_dec_decode(ctx->vpudec, &encoded_frame, &output_code)) != IMX_VPU_DEC_RETURN_CODE_OK) {
        fprintf(stderr, "imx_vpu_dec_decode() fallita: %s\n", imx_vpu_dec_error_string(ret));
        return -2; /* errore */
    }
    decode_ms = ms_since(&t1);

    if (output_code & IMX_VPU_DEC_OUTPUT_CODE_VIDEO_PARAMS_CHANGED) {
        /* Parametri video cambiati (es. cambio risoluzione a meta' stream) —
         * riapriamo il decoder pulito, semplice e robusto. */
        fprintf(stderr, "vpu-fb-decode: parametri video cambiati, riapro il decoder\n");
        imx_vpu_dec_close(ctx->vpudec);
        imx_vpu_dec_open(&(ctx->vpudec), &(ctx->open_params), ctx->bitstream_buffer, initial_info_callback, ctx);
        return 0;
    }

    if (output_code & IMX_VPU_DEC_OUTPUT_CODE_DECODED_FRAME_AVAILABLE) {
        ImxVpuRawFrame decoded_frame;
        struct timespec t2;
        imx_vpu_dec_get_decoded_frame(ctx->vpudec, &decoded_frame);

        uint8_t *base = imx_vpu_dma_buffer_map(decoded_frame.framebuffer->dma_buffer, IMX_VPU_MAPPING_FLAG_READ);
        uint8_t *y_plane = base;
        uint8_t *u_plane = base + ctx->calculated_sizes.y_size;
        uint8_t *v_plane = u_plane + ctx->calculated_sizes.cbcr_size;

        clock_gettime(CLOCK_MONOTONIC, &t2);
        blit_i420_scaled(
            ctx, y_plane, u_plane, v_plane,
            ctx->calculated_sizes.y_stride, ctx->calculated_sizes.cbcr_stride,
            ctx->initial_info.frame_width, ctx->initial_info.frame_height
        );
        blit_ms = ms_since(&t2);

        imx_vpu_dma_buffer_unmap(decoded_frame.framebuffer->dma_buffer);
        imx_vpu_dec_mark_framebuffer_as_displayed(ctx->vpudec, decoded_frame.framebuffer);
    }

    /* Segnala subito se una fase e' anomalmente lenta (probabile causa di uno
     * scatto visibile) — soglia 80ms, un quadro a 25fps ne dura circa 40. */
    if (read_ms > 80 || decode_ms > 80 || blit_ms > 80) {
        fprintf(stderr, "vpu-fb-decode: TEMPI fotogramma %u: lettura=%ldms decodifica=%ldms disegno=%ldms\n",
                ctx->frame_id_counter, read_ms, decode_ms, blit_ms);
    }

    if (output_code & IMX_VPU_DEC_OUTPUT_CODE_EOS) return -1;

    ctx->frame_id_counter++;
    return ok ? 0 : -1;
}

int main(int argc, char **argv) {
    if (argc != 6) {
        fprintf(stderr, "uso: %s <device fb> <x> <y> <w> <h>   (H.264 Annex-B con AUD su stdin)\n", argv[0]);
        return 1;
    }
    const char *fb_dev = argv[1];
    int x = atoi(argv[2]), y = atoi(argv[3]), w = atoi(argv[4]), h = atoi(argv[5]);

    /* Allarga il buffer della pipe in ingresso (default Linux: 64KB) — nei
     * momenti in cui il nostro ciclo di decodifica/disegno rallenta un po',
     * questo assorbe l'accumulo senza far bloccare ffmpeg a monte (sospettato
     * causa delle disconnessioni premature osservate con sorgenti lente). */
    if (fcntl(STDIN_FILENO, F_SETPIPE_SZ, 1024 * 1024) < 0) {
        fprintf(stderr, "vpu-fb-decode: impossibile allargare il buffer della pipe (non fatale): %s\n", strerror(errno));
    }

    /* Apre e mappa il framebuffer di destinazione */
    int fd = open(fb_dev, O_RDWR);
    if (fd < 0) { perror("open framebuffer"); return 1; }
    struct fb_var_screeninfo vinfo;
    struct fb_fix_screeninfo finfo;
    if (ioctl(fd, FBIOGET_VSCREENINFO, &vinfo) < 0) { perror("FBIOGET_VSCREENINFO"); return 1; }
    if (ioctl(fd, FBIOGET_FSCREENINFO, &finfo) < 0) { perror("FBIOGET_FSCREENINFO"); return 1; }
    if (vinfo.bits_per_pixel != 32) { fprintf(stderr, "atteso framebuffer 32bpp\n"); return 1; }
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || (unsigned)(x + w) > vinfo.xres || (unsigned)(y + h) > vinfo.yres) {
        fprintf(stderr, "rettangolo (%d,%d,%d,%d) fuori dai limiti del framebuffer (%dx%d)\n", x, y, w, h, vinfo.xres, vinfo.yres);
        return 1;
    }
    unsigned char *fbmem = mmap(NULL, finfo.smem_len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (fbmem == MAP_FAILED) { perror("mmap framebuffer"); return 1; }

    Context ctx;
    memset(&ctx, 0, sizeof(ctx));
    ctx.frame_id_counter = 100;
    ctx.fbmem = fbmem;
    ctx.fb_stride = finfo.line_length;
    ctx.dst_x = x; ctx.dst_y = y; ctx.dst_w = w; ctx.dst_h = h;
    h264_ctx_init(&(ctx.h264_ctx), stdin);

    imx_vpu_set_logging_function(logging_fn);
    imx_vpu_set_logging_threshold(IMX_VPU_LOG_LEVEL_WARNING);

    memset(&(ctx.open_params), 0, sizeof(ImxVpuDecOpenParams));
    ctx.open_params.codec_format = IMX_VPU_CODEC_FORMAT_H264;
    ctx.open_params.enable_frame_reordering = 1;

    imx_vpu_dec_load();

    size_t bitstream_buffer_size; unsigned int bitstream_buffer_alignment;
    imx_vpu_dec_get_bitstream_buffer_info(&bitstream_buffer_size, &bitstream_buffer_alignment);
    ctx.bitstream_buffer = imx_vpu_dma_buffer_allocate(imx_vpu_dec_get_default_allocator(), bitstream_buffer_size, bitstream_buffer_alignment, 0);

    if (imx_vpu_dec_open(&(ctx.vpudec), &(ctx.open_params), ctx.bitstream_buffer, initial_info_callback, &ctx) != IMX_VPU_DEC_RETURN_CODE_OK) {
        fprintf(stderr, "vpu-fb-decode: apertura decoder fallita\n");
        return 1;
    }

    fprintf(stderr, "vpu-fb-decode: avviato, decodifica hardware verso (%d,%d) %dx%d\n", x, y, w, h);

    signal(SIGTERM, on_stop_signal);
    signal(SIGINT, on_stop_signal);

    for (;;) {
        if (g_should_stop) { fprintf(stderr, "vpu-fb-decode: segnale di stop ricevuto\n"); break; }
        int r = decode_one(&ctx);
        if (r == -1) { fprintf(stderr, "vpu-fb-decode: fine flusso in ingresso\n"); break; }
        if (r == -2) { fprintf(stderr, "vpu-fb-decode: errore di decodifica, esco\n"); break; }
    }

    clear_rect(&ctx); /* non lasciare l'ultimo fotogramma congelato a schermo */

    imx_vpu_dec_close(ctx.vpudec);
    imx_vpu_dma_buffer_deallocate(ctx.bitstream_buffer);
    imx_vpu_dec_unload();
    h264_ctx_cleanup(&(ctx.h264_ctx));

    return 0;
}
