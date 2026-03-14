import Config

config :hermes, Hermes.Endpoint,
  url: [host: "localhost"],
  render_errors: [formats: [json: Hermes.ErrorJSON], layout: false],
  pubsub_server: Hermes.PubSub

config :hermes,
  kafka_brokers: [{"localhost", 9092}],
  jwt_secret: "CHANGE-ME-in-production-use-openssl-rand-hex-32"

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :user_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
