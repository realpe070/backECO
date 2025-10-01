import { FirebaseService } from '@firebase/firebase.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CreateMotivoDto } from './dto/motivo.create.dto';

@Injectable()
export class MotivosService {
  private readonly logger = new Logger(MotivosService.name);
  constructor(private readonly firebaseService: FirebaseService) {}

  async findAll() {
    const db = this.firebaseService.getFirestore();
    // Motivos
    const motivosCollection = db.collection('motivos');
    const snapshot = await motivosCollection.get();
    const motivos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return motivos;
  }

  async findActive() {
    const db = this.firebaseService.getFirestore();
    const motivosCollection = db.collection('motivos');
    const snapshot = await motivosCollection.where('estado', '==', true).get();
    const motivosActivos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return motivosActivos;
  }

  async create(createMotivoDto: CreateMotivoDto) {
    const db = this.firebaseService.getFirestore();
    const motivosCollection = db.collection('motivos');

    // validar que no exista otro motivo con el mismo nombre
    const snapshot = await motivosCollection
      .where('titulo', '==', createMotivoDto.titulo)
      .get();
    if (!snapshot.empty) {
      throw new HttpException(
        'Ya existe un ejercicio con ese nombre',
        HttpStatus.BAD_REQUEST,
      );
    }
    const docRef = await motivosCollection.add(createMotivoDto);
    return {
      id: docRef.id,
      ...createMotivoDto,
    };
  }

  async update(id: string, updateMotivoDto: any) {
    const db = this.firebaseService.getFirestore();
    const motivosCollection = db.collection('motivos');
    // validar que no exista otro motivo con el mismo nombre
    const snapshot = await motivosCollection
      .where('titulo', '==', updateMotivoDto.titulo)
      .get();

    const docRef = motivosCollection.doc(id);
    const docSnapshot = await docRef.get();

    // Only update fields that are present in updateMotivoDto
    const currentData = docSnapshot.data() || {};
    const newData = { ...currentData, ...updateMotivoDto };

    if (!docSnapshot.exists) {
      throw new HttpException('Motivo not found', HttpStatus.NOT_FOUND);
    }

    // Si hay duplicado, simplemente ignorar y continuar (no lanzar excepción)
    if (!snapshot.empty) {
      throw new HttpException(
        'Ya existe un ejercicio con ese nombre',
        HttpStatus.BAD_REQUEST,
      );
    }

    await docRef.update(newData);

    return {
      id,
      ...newData,
    };
  }

  async remove(id: string) {
    const db = this.firebaseService.getFirestore();
    const motivosCollection = db.collection('motivos');
    await motivosCollection.doc(id).delete();
    return {
      id,
    };
  }
}
