import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

export interface User {
  id: string;
  name: string;
  lastName: string;
  email: string;
  password: string;
  avatarColor: number;
  gender: string;
}

@Injectable()
export class AuthService {
  private users: User[] = []; // Lista de usuarios en memoria

  async registerUser(data: RegisterDto) {
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    const newUser: User = {
      id: (this.users.length + 1).toString(),
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      avatarColor: data.avatarColor,
      gender: data.gender,
    };

    this.users.push(newUser);
    return { message: 'Usuario registrado exitosamente', user: newUser };
  }

  async validateUser(data: LoginDto) {
    const user = this.users.find((u) => u.email === data.email);
    if (user) {
      return { message: 'Inicio de sesión exitoso', user };
    }
    return { message: 'Credenciales incorrectas', user: null };
  }
}
