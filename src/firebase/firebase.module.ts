import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Global() // 👈 Hace que FirebaseModule esté disponible en toda la aplicación
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService], // Exportamos FirebaseService para otros módulos
})
export class FirebaseModule {}
