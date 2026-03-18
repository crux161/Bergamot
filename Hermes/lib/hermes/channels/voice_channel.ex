defmodule Hermes.Channels.VoiceChannel do
  @moduledoc """
  Phoenix Channel for voice/video room signaling.

  Handles the lifecycle of a user's participation in a LiveKit-backed
  voice room:

    1. **join** — track presence, generate a signed LiveKit access token,
       and push it back to the connecting client.
    2. **leave** — presence automatically broadcasts departures.

  ## Topic format

      "voice:<room_id>"

  ## Client flow

      1. Client joins `voice:rocket-repair` via Phoenix WebSocket.
      2. Server broadcasts `"presence_state"` / `"presence_diff"` so
         every participant sees who is in the room.
      3. Server pushes `"livekit_token"` with `{token, url}` to the
         joining client.
      4. Client connects directly to Apollo (LiveKit) using the token
         for actual media transport — no media flows through Phoenix.
      5. When the client leaves the channel, Presence automatically
         broadcasts the departure.
  """

  use Phoenix.Channel

  alias Hermes.Voice.Token, as: LiveKitToken

  require Logger

  # ── Join ──────────────────────────────────────────────────────────

  @doc """
  Called when a user joins a voice room.

  1. Tracks the user in Phoenix Presence so everyone sees who's connected.
  2. Generates a LiveKit access token scoped to this room.
  3. Pushes the token + server URL back to the caller.
  """
  @impl true
  def join("voice:" <> room_id, payload, socket) do
    user_id  = socket.assigns.user_id
    username = Map.get(payload, "username", "User #{user_id}")

    Logger.info("[VoiceChannel] #{user_id} (#{username}) joining room #{room_id}")

    socket =
      socket
      |> assign(:room_id, room_id)
      |> assign(:username, username)

    # Send the token after the join reply so the client is fully connected
    send(self(), :after_join)

    {:ok, %{room_id: room_id}, socket}
  end

  # ── After Join (Presence + Token) ─────────────────────────────────

  @impl true
  def handle_info(:after_join, socket) do
    user_id  = socket.assigns.user_id
    room_id  = socket.assigns.room_id
    username = socket.assigns.username

    # Track this user in Presence
    {:ok, _ref} =
      Hermes.Presence.track(socket, user_id, %{
        username: username,
        joined_at: System.system_time(:second)
      })

    # Push current presence state so the new joiner sees who's already here
    push(socket, "presence_state", Hermes.Presence.list(socket))

    # Generate a LiveKit access token for this user + room
    case LiveKitToken.generate(user_id, room_id) do
      {:ok, token} ->
        push(socket, "livekit_token", %{
          token: token,
          url: LiveKitToken.server_url()
        })

      {:error, reason} ->
        Logger.error("[VoiceChannel] Failed to generate LiveKit token: #{inspect(reason)}")

        push(socket, "error", %{
          reason: "Failed to generate voice token. Please try again."
        })
    end

    {:noreply, socket}
  end

  # ── Incoming events ───────────────────────────────────────────────

  # Broadcasts participant state changes (mute, video, screen share) to the room
  # so the UI can show indicators without waiting for LiveKit track events.
  @impl true
  def handle_in(event, payload, socket)

  def handle_in("mute_state", %{"muted" => muted}, socket) do
    broadcast_from!(socket, "mute_state", %{
      user_id: socket.assigns.user_id,
      muted: muted
    })

    {:noreply, socket}
  end

  def handle_in("video_state", %{"enabled" => enabled}, socket) do
    broadcast_from!(socket, "video_state", %{
      user_id: socket.assigns.user_id,
      enabled: enabled
    })

    {:noreply, socket}
  end

  def handle_in("screen_share_state", %{"sharing" => sharing}, socket) do
    broadcast_from!(socket, "screen_share_state", %{
      user_id: socket.assigns.user_id,
      sharing: sharing
    })

    {:noreply, socket}
  end

  # ── Terminate ─────────────────────────────────────────────────────

  @impl true
  def terminate(reason, socket) do
    Logger.info(
      "[VoiceChannel] #{socket.assigns.user_id} left room #{socket.assigns[:room_id]}" <>
        " (reason: #{inspect(reason)})"
    )

    :ok
  end
end
