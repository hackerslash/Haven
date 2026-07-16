import { invoke } from "@tauri-apps/api/core";

// Thin wrappers around the Rust-side Ed25519 identity commands. The private
// key never crosses this boundary — every command here returns only public
// data or a signature, never key material (see src-tauri/src/identity.rs).

export type PublicIdentity = {
  identityId: string;
  publicKey: string;
};

export function hasKeypair(): Promise<boolean> {
  return invoke("identity_has_keypair");
}

export function generateKeypair(): Promise<PublicIdentity> {
  return invoke("identity_generate_keypair");
}

export function getPublicKey(): Promise<PublicIdentity | null> {
  return invoke("identity_get_public_key");
}

export function sign(messageBase64: string): Promise<string> {
  return invoke("identity_sign", { messageBase64 });
}

export function verify(
  publicKeyBase64: string,
  messageBase64: string,
  signatureBase64: string,
): Promise<boolean> {
  return invoke("identity_verify", {
    publicKeyBase64,
    messageBase64,
    signatureBase64,
  });
}

export function deleteKeypair(): Promise<void> {
  return invoke("identity_delete_keypair");
}
