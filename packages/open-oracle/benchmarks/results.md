# Open Oracle local benchmark

Synthetic offline workload; not provider throughput, network latency, production capacity or absolute price accuracy.

Node v26.13.0; darwin arm64; Apple M4.

| Workload | Operations | Duration ms | Operations/s | Heap delta bytes |
| --- | --- | --- | --- | --- |
| synthetic_inventory_registration | 10000 | 10.17 | 983014 | 11197096 |
| triple_composite | 20000 | 1356.94 | 14739 | 1773600 |
| normalization | 100000 | 6.58 | 15187470 | 2066328 |
| three_timeframe_candle_generation | 20000 | 321.59 | 62191 | 3805176 |
| causal_replay | 3000 | 56.46 | 53133 | 9359696 |
| 10000_single_source_markets_batch_evaluation | 10000 | 146.99 | 68033 | 36024400 |
