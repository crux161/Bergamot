defmodule Hermes.Channels.ChatChannel do
  @moduledoc """
  Phoenix Channel for real-time chat messaging.

  Handles join, message broadcast, and typing indicator events.
  Every new message is also published to Kafka so downstream services
  (Thoth, Heimdall, etc.) can persist and process it.
  """

  use Phoenix.Channel

  alias Hermes.Kafka.Producer

  require Logger

  @doc """
  Join a channel room.  Topic format: "channel:<channel_id>"
  """
  @impl true
  def join("channel:" <> channel_id, _payload, socket) do
    Logger.info("User #{socket.assigns.user_id} joining channel #{channel_id}")
    socket = assign(socket, :channel_id, channel_id)
    {:ok, %{channel_id: channel_id}, socket}
  end

  @doc """
  Handle an incoming "new_message" event from the client.
  1. Broadcast the message to all other users in this channel.
  2. Publish a message_created event to Kafka for Thoth to persist.
  """
  @impl true
  def handle_in("new_message", %{"content" => content} = payload, socket) do
    user_id = socket.assigns.user_id
    channel_id = socket.assigns.channel_id
    message_id = generate_id()
    now = DateTime.utc_now() |> DateTime.to_iso8601()

    message = %{
      id: message_id,
      content: content,
      sender_id: user_id,
      channel_id: channel_id,
      timestamp: now,
      nonce: Map.get(payload, "nonce")
    }

    # Broadcast to everyone else in the channel
    broadcast_from!(socket, "new_message", message)

    # Publish to Kafka for downstream consumers (Thoth, Heimdall, etc.)
    kafka_event = %{
      event_type: "message_created",
      channel_id: channel_id,
      sender_id: user_id,
      message_id: message_id,
      content: content,
      timestamp: now
    }

    case Producer.publish_message_event(kafka_event) do
      :ok ->
        {:reply, {:ok, message}, socket}

      {:error, reason} ->
        Logger.error("Kafka publish failed: #{inspect(reason)}")
        # Still acknowledge to the client — message was broadcast live.
        # Thoth will have retry/dead-letter handling.
        {:reply, {:ok, Map.put(message, :kafka_status, "deferred")}, socket}
    end
  end

  @doc """
  Broadcasts a typing indicator to other users in the channel.
  """
  def handle_in("typing", _payload, socket) do
    broadcast_from!(socket, "typing", %{user_id: socket.assigns.user_id})
    {:noreply, socket}
  end

  # Simple monotonic + random ID — Thoth will assign the canonical Snowflake ID
  defp generate_id do
    ts = System.system_time(:microsecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{ts}-#{rand}"
  end
end
