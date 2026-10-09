import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsObject, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
// Optional means absent, not null: null must not bypass PATCH validation.
const present = (_: unknown, value: unknown) => value !== undefined;
export class PageDto {
  @ValidateIf(present) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @ValidateIf(present) @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset?: number;
}
export class StudentDto {
  @IsString() @Matches(/^[A-Za-z0-9_.-]{3,64}$/) username!: string;
  @Transform(trim) @IsString() @Length(1, 120) display_name!: string;
  @IsString() @Length(12, 72) password!: string;
}
export class TeacherDto extends StudentDto {}
export class StudentStatusDto { @IsIn(['pending', 'active', 'suspended']) status!: string; }
export class TeacherStatusDto { @IsIn(['active', 'suspended']) status!: string; }
export class ConsentDto {
  @Transform(trim) @IsString() @Length(1, 120) guardian_name!: string;
  @Transform(trim) @IsString() @Length(1, 32) consent_version!: string;
  @ValidateIf(present) @IsEmail() @Length(1, 191) guardian_contact_email?: string;
}
export class ClassroomDto {
  @ValidateIf(present) @IsUUID('4') teacher_id?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) level_id!: number;
  @IsUUID('4') course_id!: string;
  @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 180) school_name?: string;
  @IsInt() @Min(2000) @Max(2100) academic_year!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) course_start_date!: string;
}
export class ClassroomPatchDto {
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 120) name?: string;
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 180) school_name?: string;
  @ValidateIf(present) @IsIn(['active', 'archived']) status?: string;
}
export class EnrollmentDto { @IsUUID('4') student_id!: string; }
export class ProjectDto {
  @Transform(trim) @IsString() @Length(1, 180) title!: string;
  @Transform(trim) @IsString() @IsIn(['character_recognition']) project_type!: string;
  @ValidateIf(present) @IsUUID('4') classroom_id?: string;
}
export class ProjectPatchDto {
  @ValidateIf(present) @Transform(trim) @IsString() @Length(1, 180) title?: string;
  @ValidateIf(present) @IsIn(['draft', 'active', 'completed', 'archived']) status?: string;
}
export class WorkspaceDto {
  @IsInt() @Min(0) @Max(4294967294) version!: number;
  @IsObject() blocks!: Record<string, unknown>;
}
export class ProgressDto { @IsInt() @Min(0) @Max(255) completed_sections!: number; }
