import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  declare email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  declare password: string;
}
