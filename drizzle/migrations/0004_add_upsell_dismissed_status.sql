-- Migration: 0004_add_upsell_dismissed_status
-- Adds the 'upsell_dismissed' value to the letter_status PostgreSQL enum.
-- PostgreSQL cannot drop enum values, so there is no reversible down step.
-- Must be applied before deploying any code that writes letterStatus = 'upsell_dismissed'.

ALTER TYPE "public"."letter_status" ADD VALUE IF NOT EXISTS 'upsell_dismissed' BEFORE 'pending_review';
