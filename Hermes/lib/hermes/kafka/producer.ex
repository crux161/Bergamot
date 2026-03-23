defmodule Hermes.Kafka.Producer do
  @moduledoc """
  Publishes events to Kafka topics via brod.
  Messages are keyed by channel_id for partition ordering.
  """

  require Logger

  @topic "chat.messages"
  @activity_topic "bergamot.activity"

  @spec publish_event(String.t(), String.t(), map()) :: :ok | {:error, term()}
  def publish_event(topic, partition_key, event) do
    payload = Jason.encode!(event)

    case :brod.produce_sync(:hermes_kafka_client, topic, :hash, partition_key, payload) do
      :ok ->
        :ok

      {:error, reason} = err ->
        Logger.error("Failed to publish to #{topic}: #{inspect(reason)}")
        err
    end
  end

  @doc """
  Publishes a chat message event to the `chat.messages` Kafka topic.

  The event is JSON-encoded and partitioned by `channel_id` to
  guarantee ordering within a channel. Returns `:ok` or `{:error, reason}`.
  """
  @spec publish_message_event(map()) :: :ok | {:error, term()}
  def publish_message_event(%{channel_id: channel_id} = event) do
    publish_event(@topic, channel_id, event)
  end

  @doc """
  Publishes a Janus-originated canonical activity event to `bergamot.activity`.
  """
  @spec publish_activity_event(String.t(), map()) :: :ok | {:error, term()}
  def publish_activity_event(partition_key, event) do
    publish_event(@activity_topic, partition_key, event)
  end
end
