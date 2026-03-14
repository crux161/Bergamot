import Config

config :hermes, Hermes.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: String.duplicate("test_secret_", 8),
  server: false

config :logger, level: :warning
