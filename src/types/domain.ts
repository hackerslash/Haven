export type Identity = {
  identityId: string;
  publicKey: string;
  displayName: string;
  avatarPath: string | null;
  statusMessage: string | null;
  createdAt: number;
};
