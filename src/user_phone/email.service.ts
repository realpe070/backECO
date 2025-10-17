import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { FirebaseService } from '@firebase/firebase.service';
import * as crypto from 'crypto';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly firebaseService: FirebaseService,
  ) {}

  private readonly logger = new Logger(MailService.name);
  
  async sendPasswordResetEmail(email: string) {
    // Generar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expirationTime = Date.now() + 3600000; // 1 hora de expiración

    const db = this.firebaseService.getFirestore();
    
    // Buscar usuario por email
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      throw new Error('Usuario no encontrado');
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // Guardar token en colección temporal
    await db.collection('passwordResetTokens').doc(userId).set({
      token: resetToken,
      email: email,
      expiresAt: expirationTime,
      used: false,
      createdAt: Date.now()
    });

    // URL completa con el token
    const resetUrl = `https://backeco-zwl8.onrender.com/reset-password.html?token=${resetToken}`; 

    await this.mailerService.sendMail({
      to: email,
      subject: 'Restablece tu contraseña ✔',
      html: `
        <h1>¡Restablecer contraseña - EcoBreak! 🎉</h1>
        <p>Haz clic en el enlace para restablecer tu contraseña:</p>
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Restablecer contraseña
        </a>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, ignora este email.</p>
      `,
    });

    return { message: 'Email de recuperación enviado correctamente' };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
  try {
    const db = this.firebaseService.getFirestore();
    
    // Buscar el token en la colección
    const tokenQuery = await db.collection('passwordResetTokens')
      .where('token', '==', token)
      .where('used', '==', false)
      .get();

    if (tokenQuery.empty) {
      throw new Error('Token inválido o ya utilizado');
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data();

    // Verificar si el token no ha expirado
    if (Date.now() > tokenData.expiresAt) {
      throw new Error('Token expirado');
    }

    // Buscar el usuario por email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', tokenData.email)
      .get();

    if (usersSnapshot.empty) {
      throw new Error('Usuario no encontrado');
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // Hashear la nueva contraseña
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(newPassword, salt, 64) as Buffer;
    const hashedPassword = `${salt}:${derived.toString('hex')}`;

    // Actualizar la contraseña en la colección users
    await db.collection('users').doc(userId).update({
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    // Marcar el token como usado
    await db.collection('passwordResetTokens').doc(tokenDoc.id).update({
      used: true,
      usedAt: Date.now()
    });

    this.logger.log(`✅ Contraseña actualizada para usuario: ${tokenData.email}`);
    
    return {
      status: true,
      message: 'Contraseña actualizada correctamente'
    };

  } catch (error) {
    this.logger.error('❌ Error actualizando contraseña:', error);
    throw new Error(error instanceof Error ? error.message : 'Error actualizando contraseña');
  }
}
}
