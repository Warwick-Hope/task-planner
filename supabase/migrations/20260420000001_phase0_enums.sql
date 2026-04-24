-- Phase 0.1: Drop existing dev tables and recreate enums
-- WARNING: Destructive. Dev only. Never run on prod.

-- Drop all existing tables (old schema)
drop table if exists public.non_negotiables cascade;
drop table if exists public.tasks cascade;
drop table if exists public.role_categories cascade;
drop table if exists public.categories cascade;
drop table if exists public.missions cascade;
drop table if exists public.values cascade;
drop table if exists public.profiles cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.household_profiles cascade;
drop table if exists public.household_invitations cascade;
drop table if exists public.rooms cascade;
drop table if exists public.meals cascade;
drop table if exists public.meal_plan cascade;
drop table if exists public.ingredients cascade;
drop table if exists public.shopping_list cascade;

-- Drop old enums if they exist
drop type if exists public.task_status cascade;
drop type if exists public.workspace_type cascade;
drop type if exists public.member_role cascade;
drop type if exists public.task_source cascade;
drop type if exists public.assignment_status cascade;

-- Recreate enums
create type public.task_status as enum ('not_started', 'wip', 'done', 'cancelled');
create type public.workspace_type as enum ('personal', 'household');
create type public.member_role as enum ('owner', 'adult', 'restricted');
create type public.task_source as enum ('manual', 'brain_dump', 'cleaning', 'meal', 'shopping');
create type public.assignment_status as enum ('none', 'pending', 'accepted', 'declined');
