import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
  @IsString() @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  username!: string;
  @IsString() @MinLength(1) @MaxLength(72)
  password!: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(72)
  current_password!: string;
  @IsString() @MinLength(12) @MaxLength(72)
  new_password!: string;
}
