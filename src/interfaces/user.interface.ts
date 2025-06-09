export interface UserResponseDto {
    uid: string;
    email: string | null | undefined;
    displayName: string | null;
    photoURL: string | null | undefined;  // Actualizado para aceptar undefined
    disabled: boolean;
    metadata: {
        creationTime: string;
        lastSignInTime: string;
    };
}

export interface FirestoreDoc {
    id: string;
    exists: boolean;
    data(): any;
}
