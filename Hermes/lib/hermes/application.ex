defmodule Hermes.Application do
  @moduledoc """
  OTP Application for Hermes.

  Starts the supervision tree including Phoenix PubSub, the brod Kafka
  client, telemetry, and the HTTP/WebSocket endpoint.
  """
  use Application

  @impl true
  def start(_type, _args) do
    kafka_brokers = Application.get_env(:hermes, :kafka_brokers, [{"localhost", 9092}])

    children = [
      Hermes.Telemetry,
      {Phoenix.PubSub, name: Hermes.PubSub},
      # Presence tracker for voice rooms
      Hermes.Presence,
      # Kafka producer client via brod
      %{
        id: :kafka_client,
        start:
          {:brod_client, :start_link,
           [kafka_brokers, :hermes_kafka_client, [auto_start_producers: true]]}
      },
      Hermes.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Hermes.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    Hermes.Endpoint.config_change(changed, removed)
    :ok
  end
end
