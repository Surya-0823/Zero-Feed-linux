import { prisma } from '../db/prisma';
import { User } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });
  }

  async updateProfile(id: string, data: { name?: string; avatarUrl?: string }): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        subscription: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
