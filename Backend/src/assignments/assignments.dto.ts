import { Transform } from 'class-transformer';
import { IsISO8601, IsNumber, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const present = (_: unknown, value: unknown) => value !== undefined;

export class AssignmentDto {
  @Transform(trim) @IsString() @Length(1, 180) title!: string;
  @Transform(trim) @IsString() @Length(1, 5000) description!: string;
  @Transform(trim) @IsString() @Length(1, 5000) instructions!: string;
  @IsISO8601() starts_at!: string;
  @IsISO8601() ends_at!: string;
  @IsNumber() @Min(0) @Max(1000) grade_min!: number;
  @IsNumber() @Min(0) @Max(1000) grade_max!: number;
}
export class AssignmentPatchDto {
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 180) title?: string;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 5000) description?: string;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 5000) instructions?: string;
  @ValidateIf(present) @IsISO8601() starts_at?: string;
  @ValidateIf(present) @IsISO8601() ends_at?: string;
  @ValidateIf(present) @IsNumber() @Min(0) @Max(1000) grade_min?: number;
  @ValidateIf(present) @IsNumber() @Min(0) @Max(1000) grade_max?: number;
}
export class SubmissionDto {
  @IsUUID('4') project_id!: string;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(0, 1000) comment?: string;
}
export class GradeDto {
  @IsNumber() @Min(0) @Max(1000) grade!: number;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(0, 2000) feedback?: string;
}
