import Config

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE not set"

  jwt_secret =
    System.get_env("JWT_SECRET") ||
      raise "JWT_SECRET not set"

  internal_broadcast_secret = System.get_env("HERMES_INTERNAL_SECRET", "bergamot-hermes-internal-dev")

  kafka_host = System.get_env("KAFKA_HOST", "kafka")
  kafka_port = System.get_env("KAFKA_PORT", "9092") |> String.to_integer()
  port = System.get_env("PORT", "4000") |> String.to_integer()

  config :hermes, Hermes.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  livekit_url = System.get_env("LIVEKIT_URL") || raise "LIVEKIT_URL not set"
  livekit_api_key = System.get_env("LIVEKIT_API_KEY") || raise "LIVEKIT_API_KEY not set"
  livekit_api_secret = System.get_env("LIVEKIT_API_SECRET") || raise "LIVEKIT_API_SECRET not set"

  config :hermes,
    jwt_secret: jwt_secret,
    internal_broadcast_secret: internal_broadcast_secret,
    kafka_brokers: [{kafka_host, kafka_port}],
    livekit_url: livekit_url,
    livekit_api_key: livekit_api_key,
    livekit_api_secret: livekit_api_secret
end
