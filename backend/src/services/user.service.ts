import { userRepository, UserRepository } from '../repositories/user.repository';

export class UserService {
  private userRepo: UserRepository;

  constructor(repo: UserRepository = userRepository) {
    this.userRepo = repo;
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      googleId: user.googleId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    return this.userRepo.updateProfile(userId, data);
  }
}

export const userService = new UserService();
