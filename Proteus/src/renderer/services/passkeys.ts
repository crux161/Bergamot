function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array | null): string | null {
  if (!value) return null;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeCreationOptions(options: Record<string, any>): PublicKeyCredentialCreationOptions {
  return {
    rp: options.rp,
    challenge: decodeBase64Url(options.challenge),
    user: {
      ...options.user,
      id: decodeBase64Url(options.user.id),
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    attestation: options.attestation,
    authenticatorSelection: options.authenticatorSelection,
    excludeCredentials: (options.excludeCredentials || []).map((descriptor: Record<string, any>) => ({
      ...descriptor,
      id: decodeBase64Url(descriptor.id),
    })),
    extensions: options.extensions,
  };
}

function normalizeRequestOptions(options: Record<string, any>): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: decodeBase64Url(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((descriptor: Record<string, any>) => ({
      ...descriptor,
      id: decodeBase64Url(descriptor.id),
    })),
  };
}

function serializeCredential(credential: PublicKeyCredential): Record<string, any> {
  const base = {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };

  if (credential.response instanceof AuthenticatorAttestationResponse) {
    return {
      ...base,
      response: {
        attestationObject: encodeBase64Url(credential.response.attestationObject),
        clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
        transports: typeof credential.response.getTransports === "function"
          ? credential.response.getTransports()
          : [],
      },
    };
  }

  const assertion = credential.response as AuthenticatorAssertionResponse;
  return {
    ...base,
    response: {
      authenticatorData: encodeBase64Url(assertion.authenticatorData),
      clientDataJSON: encodeBase64Url(assertion.clientDataJSON),
      signature: encodeBase64Url(assertion.signature),
      userHandle: encodeBase64Url(assertion.userHandle),
    },
  };
}

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined"
    && typeof window.PublicKeyCredential !== "undefined"
    && window.isSecureContext;
}

export async function createPasskey(publicKey: Record<string, any>): Promise<Record<string, any>> {
  const credential = await navigator.credentials.create({
    publicKey: normalizeCreationOptions(publicKey),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey registration was cancelled");
  }
  return serializeCredential(credential);
}

export async function getPasskeyAssertion(publicKey: Record<string, any>): Promise<Record<string, any>> {
  const credential = await navigator.credentials.get({
    publicKey: normalizeRequestOptions(publicKey),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey sign-in was cancelled");
  }
  return serializeCredential(credential);
}
