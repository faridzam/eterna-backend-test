import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  declare name: string;

  @IsEmail()
  @MaxLength(254)
  declare email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  declare password: string;
}
