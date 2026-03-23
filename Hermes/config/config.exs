import Config

config :hermes, Hermes.Endpoint,
  url: [host: "localhost"],
  render_errors: [formats: [json: Hermes.ErrorJSON], layout: false],
  pubsub_server: Hermes.PubSub

config :hermes,
  kafka_brokers: [{"localhost", 9092}],
  jwt_secret: "CHANGE-ME-in-production-use-openssl-rand-hex-32",
  internal_broadcast_secret: "bergamot-hermes-internal-dev",
  # Apollo (LiveKit SFU) — must match keys in Apollo/livekit.yaml
  livekit_url: "ws://localhost:7880",
  livekit_api_key: "bergamot_apollo_dev",
  livekit_api_secret: "s3cr3t_ap0ll0_k3y_d0_n0t_us3_1n_pr0d"

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :user_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
