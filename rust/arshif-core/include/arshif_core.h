#ifndef ARSHIF_CORE_H
#define ARSHIF_CORE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

uint32_t arshif_version(void);
uint8_t *arshif_alloc(size_t len);
void arshif_dealloc(uint8_t *ptr, size_t len);

uint32_t arshif_seal_backup(
    const uint8_t *key_ptr, size_t key_len,
    const uint8_t *header_ptr, size_t header_len,
    const uint8_t *nonce_ptr, size_t nonce_len,
    const uint8_t *plain_ptr, size_t plain_len,
    uint8_t **out_ptr, size_t *out_len
);

uint32_t arshif_read_backup_header(
    const uint8_t *file_ptr, size_t file_len,
    size_t *out_offset, size_t *out_len
);

uint32_t arshif_open_backup(
    const uint8_t *key_ptr, size_t key_len,
    const uint8_t *file_ptr, size_t file_len,
    uint8_t **out_ptr, size_t *out_len
);

uint32_t arshif_format_recovery_key(
    const uint8_t *key_ptr, size_t key_len,
    uint8_t **out_ptr, size_t *out_len
);

uint32_t arshif_parse_recovery_key(
    const uint8_t *str_ptr, size_t str_len,
    uint8_t *out_key_32
);

uint32_t arshif_rate_to_scaled_str(
    const uint8_t *rate_ptr, size_t rate_len,
    uint8_t **out_ptr, size_t *out_len
);

uint32_t arshif_cross_rate(
    const uint8_t *from_ptr, size_t from_len,
    const uint8_t *to_ptr, size_t to_len,
    uint8_t **out_ptr, size_t *out_len
);

uint32_t arshif_convert_minor(
    int64_t minor, uint32_t from_exp, uint32_t to_exp,
    const uint8_t *rate_ptr, size_t rate_len,
    int64_t *out_i64
);

uint32_t arshif_convert_major_fixed10(
    const uint8_t *fixed10_ptr, size_t fixed10_len,
    uint32_t is_negative, uint32_t to_exp,
    const uint8_t *rate_ptr, size_t rate_len,
    int64_t *out_i64
);

uint32_t arshif_parse_amount_input(
    const uint8_t *text_ptr, size_t text_len,
    uint32_t exponent, int64_t *out_i64
);

double arshif_similarity(
    const uint8_t *a_ptr, size_t a_len,
    const uint8_t *b_ptr, size_t b_len
);

uint32_t arshif_reconcile_balances(
    int64_t base_balance, int64_t closing_balance,
    const int64_t *deltas_ptr, size_t deltas_len,
    int64_t *out_projected, int64_t *out_diff
);

uint32_t arshif_parse_smartlog_amount(
    const uint8_t *raw_ptr, size_t raw_len,
    uint32_t exponent, int64_t *out_i64
);

uint32_t arshif_cyrb53_hash(
    const uint8_t *str_ptr, size_t str_len,
    uint8_t *out_hex_16
);

#ifdef __cplusplus
}
#endif

#endif /* ARSHIF_CORE_H */
