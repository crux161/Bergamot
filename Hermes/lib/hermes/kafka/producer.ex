defmodule Hermes.Kafka.Producer do
  @moduledoc """
  Publishes events to Kafka topics via brod.
  Messages are keyed by channel_id for partition ordering.
  """

  require Logger

  @topic "chat.events"

  @doc """
  Publishes a chat message event to the `chat.events` Kafka topic.

  The event is JSON-encoded and partitioned by `channel_id` to
  guarantee ordering within a channel. Returns `:ok` or `{:error, reason}`.
  """
  @spec publish_message_event(map()) :: :ok | {:error, term()}
  def publish_message_event(%{channel_id: channel_id} = event) do
    payload = Jason.encode!(event)
    partition_key = channel_id

    case :brod.produce_sync(:hermes_kafka_client, @topic, :hash, partition_key, payload) do
      :ok ->
        :ok

      {:error, reason} = err ->
        Logger.error("Failed to publish to #{@topic}: #{inspect(reason)}")
        err
    end
  end
end
