#!/usr/bin/env python3
"""Reorder keymap.yaml keys from ZMK interleaved order to non-interleaved order.

ZMK outputs keys interleaved row-by-row (row0L, row0R, row1L, row1R, ...),
but keymap-drawer's --cols-thumbs-notation expects all-left then all-right.

Recollection layout:
  row0: 5L + 5R
  row1: 6L + 6R
  row2: 6L + 6R
  thumb: 6L + 3R
  Total: 43 keys
"""

import sys
import yaml

# Mapping: interleaved_index -> non_interleaved_position
# Non-interleaved order: row0L(0-4), row1L(5-10), row2L(11-16), thumbL(17-22),
#                        row0R(23-27), row1R(28-33), row2R(34-39), thumbR(40-42)
INTERLEAVED_TO_ORDERED = {}
for i in range(5):  INTERLEAVED_TO_ORDERED[i]      = i       # row0L
for i in range(5):  INTERLEAVED_TO_ORDERED[5  + i] = 23 + i  # row0R
for i in range(6):  INTERLEAVED_TO_ORDERED[10 + i] = 5  + i  # row1L
for i in range(6):  INTERLEAVED_TO_ORDERED[16 + i] = 28 + i  # row1R
for i in range(6):  INTERLEAVED_TO_ORDERED[22 + i] = 11 + i  # row2L
for i in range(6):  INTERLEAVED_TO_ORDERED[28 + i] = 34 + i  # row2R
for i in range(6):  INTERLEAVED_TO_ORDERED[34 + i] = 17 + i  # thumbL
for i in range(3):  INTERLEAVED_TO_ORDERED[40 + i] = 40 + i  # thumbR

ORDERED_TO_INTERLEAVED = {v: k for k, v in INTERLEAVED_TO_ORDERED.items()}

TOTAL_KEYS = 43


def reorder_layer(keys):
    new_keys = [None] * TOTAL_KEYS
    for new_pos in range(TOTAL_KEYS):
        old_pos = ORDERED_TO_INTERLEAVED[new_pos]
        new_keys[new_pos] = keys[old_pos]
    return new_keys


def reorder_combos(combos):
    result = []
    for combo in combos:
        new_combo = dict(combo)
        new_combo['p'] = [INTERLEAVED_TO_ORDERED[p] for p in combo['p']]
        result.append(new_combo)
    return result


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'keymap.yaml'

    with open(path, 'r') as f:
        data = yaml.safe_load(f)

    for layer_name, keys in data['layers'].items():
        if isinstance(keys, list) and len(keys) == TOTAL_KEYS:
            data['layers'][layer_name] = reorder_layer(keys)

    if 'combos' in data:
        data['combos'] = reorder_combos(data['combos'])

    with open(path, 'w') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"Reordered {TOTAL_KEYS} keys per layer in {path}")


if __name__ == '__main__':
    main()
