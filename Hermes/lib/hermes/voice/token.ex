defmodule Hermes.Voice.Token do
  @moduledoc """
  Generates signed LiveKit access tokens for Apollo (the SFU).

  LiveKit tokens are standard JWTs (HS256) with a specific claims structure:

    - `iss`   — the API key (identifies which key pair signed this token)
    - `sub`   — the participant identity (unique per user in the room)
    - `nbf`   — not-before timestamp
    - `exp`   — expiration timestamp
    - `video` — a map of grant permissions (room name, publish/subscribe, etc.)

  Reference: https://docs.livekit.io/home/get-started/authentication/
  """

  @default_ttl_seconds 6 * 60 * 60  # 6 hours

  @doc """
  Creates a signed LiveKit JWT granting the user permission to join `room_name`.

  ## Options

    * `:ttl` — token lifetime in seconds (default: #{@default_ttl_seconds})
    * `:can_publish` — allow publishing audio/video tracks (default: true)
    * `:can_subscribe` — allow subscribing to others' tracks (default: true)
    * `:can_publish_data` — allow publishing data messages (default: true)

  ## Returns

  `{:ok, token_string}` or `{:error, reason}`

  ## Example

      iex> Hermes.Voice.Token.generate("user_42", "rocket-repair")
      {:ok, "eyJhbGciOiJIUzI1NiIs..."}
  """
  @spec generate(String.t(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def generate(identity, room_name, opts \\ []) do
    api_key    = Application.fetch_env!(:hermes, :livekit_api_key)
    api_secret = Application.fetch_env!(:hermes, :livekit_api_secret)

    ttl             = Keyword.get(opts, :ttl, @default_ttl_seconds)
    can_publish      = Keyword.get(opts, :can_publish, true)
    can_subscribe    = Keyword.get(opts, :can_subscribe, true)
    can_publish_data = Keyword.get(opts, :can_publish_data, true)

    now = System.system_time(:second)

    # LiveKit video grant — controls what the participant can do
    video_grant = %{
      "roomJoin"       => true,
      "room"           => room_name,
      "canPublish"     => can_publish,
      "canSubscribe"   => can_subscribe,
      "canPublishData" => can_publish_data
    }

    claims = %{
      "iss"   => api_key,
      "sub"   => identity,
      "nbf"   => now,
      "exp"   => now + ttl,
      "iat"   => now,
      "jti"   => generate_jti(),
      "video" => video_grant
    }

    jwk = JOSE.JWK.from_oct(api_secret)
    jws = %{"alg" => "HS256", "typ" => "JWT"}

    {_, token} = JOSE.JWT.sign(jwk, jws, claims) |> JOSE.JWS.compact()
    {:ok, token}
  rescue
    error -> {:error, error}
  end

  @doc """
  Returns the configured LiveKit WebSocket URL that clients connect to directly.

  In dev this is `ws://localhost:7880`, in production it's the Apollo cluster URL.
  """
  @spec server_url() :: String.t()
  def server_url do
    Application.fetch_env!(:hermes, :livekit_url)
  end

  # Unique token ID to prevent replay
  defp generate_jti do
    :crypto.strong_rand_bytes(12) |> Base.url_encode64(padding: false)
  end
end
