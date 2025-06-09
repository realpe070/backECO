export interface UserResponseDto {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  creationTime: string;
  lastSignInTime: string;
  status: 'active' | 'disabled';
  // Campos adicionales específicos
  name?: string | null;
  lastName?: string | null;
  gender?: string | null;
  avatarColor?: number | null;
  createdAt?: string | null;
}
