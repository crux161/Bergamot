defmodule Hermes.Channels.ChatChannel do
  @moduledoc """
  Phoenix Channel for real-time chat messaging.

  Handles join, message broadcast, typing indicator, reactions,
  pins, edits, and reply events.  Every new message is also
  published to Kafka so downstream services (Thoth, Heimdall, etc.)
  can persist and process it.
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

  # ── New Message ──

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
      nonce: Map.get(payload, "nonce"),
      reply_to_id: Map.get(payload, "reply_to_id")
    }

    broadcast_from!(socket, "new_message", message)

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
        {:reply, {:ok, Map.put(message, :kafka_status, "deferred")}, socket}
    end
  end

  # ── Message Edit ──

  def handle_in("edit_message", %{"message_id" => message_id, "content" => content}, socket) do
    user_id = socket.assigns.user_id
    now = DateTime.utc_now() |> DateTime.to_iso8601()

    event = %{
      message_id: message_id,
      content: content,
      edited_at: now,
      editor_id: user_id
    }

    broadcast_from!(socket, "message_edited", event)
    {:reply, {:ok, event}, socket}
  end

  # ── Message Delete ──

  def handle_in("delete_message", %{"message_id" => message_id}, socket) do
    user_id = socket.assigns.user_id
    channel_id = socket.assigns.channel_id

    event = %{
      message_id: message_id,
      channel_id: channel_id,
      deleted_by: user_id
    }

    broadcast_from!(socket, "message_deleted", event)
    {:reply, {:ok, event}, socket}
  end

  # ── Reactions ──

  def handle_in("reaction_add", %{"message_id" => message_id, "emoji" => emoji}, socket) do
    user_id = socket.assigns.user_id

    event = %{
      message_id: message_id,
      emoji: emoji,
      user_id: user_id
    }

    broadcast!(socket, "reaction_add", event)
    {:noreply, socket}
  end

  def handle_in("reaction_remove", %{"message_id" => message_id, "emoji" => emoji}, socket) do
    user_id = socket.assigns.user_id

    event = %{
      message_id: message_id,
      emoji: emoji,
      user_id: user_id
    }

    broadcast!(socket, "reaction_remove", event)
    {:noreply, socket}
  end

  # ── Pins ──

  def handle_in("pin_message", %{"message_id" => message_id}, socket) do
    user_id = socket.assigns.user_id
    channel_id = socket.assigns.channel_id
    now = DateTime.utc_now() |> DateTime.to_iso8601()

    event = %{
      message_id: message_id,
      channel_id: channel_id,
      pinned_by: user_id,
      pinned_at: now
    }

    broadcast!(socket, "message_pinned", event)
    {:noreply, socket}
  end

  def handle_in("unpin_message", %{"message_id" => message_id}, socket) do
    channel_id = socket.assigns.channel_id

    event = %{
      message_id: message_id,
      channel_id: channel_id
    }

    broadcast!(socket, "message_unpinned", event)
    {:noreply, socket}
  end

  # ── Typing ──

  def handle_in("typing", payload, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      username: Map.get(payload, "username", "Someone")
    })

    {:noreply, socket}
  end

  # Simple monotonic + random ID — Thoth will assign the canonical Snowflake ID
  defp generate_id do
    ts = System.system_time(:microsecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{ts}-#{rand}"
  end
end
