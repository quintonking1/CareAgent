CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`rule_id` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`summary` text,
	`evidence` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`provider_id` integer NOT NULL,
	`alert_id` integer,
	`start_at` text NOT NULL,
	`zocdoc_confirmation` text,
	`status` text DEFAULT 'booked' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`reason` text,
	`calendar_event_id` text,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`payload` text NOT NULL,
	`summary` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`parent_required` integer DEFAULT false NOT NULL,
	`decisions` text DEFAULT '[]' NOT NULL,
	`result` text,
	`requested_at` text NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`executed_at` text,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `brief_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `care_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_name` text NOT NULL,
	`dob` text NOT NULL,
	`timezone` text NOT NULL,
	`insurance_plan` text NOT NULL,
	`parent_phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`allergies` text DEFAULT '[]' NOT NULL,
	`pharmacy` text DEFAULT '' NOT NULL,
	`wearable_source` text DEFAULT 'apple_health' NOT NULL,
	`alert_config` text,
	`status_line` text
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`role` text NOT NULL,
	`author_id` integer,
	`content` text NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`trace` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`shared_data` text NOT NULL,
	`parent_approval_required` integer NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `med_change_proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visit_summary_id` integer NOT NULL,
	`diff` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`visit_summary_id`) REFERENCES `visit_summaries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`frequency` text NOT NULL,
	`days_supply` integer NOT NULL,
	`last_fill_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`care_profile_id` integer NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `previsit_briefs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_id` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`name` text NOT NULL,
	`specialty` text NOT NULL,
	`zocdoc_provider_id` text NOT NULL,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_profile_id` integer NOT NULL,
	`source` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`care_profile_id`) REFERENCES `care_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `refills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`status` text NOT NULL,
	`requested_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_id` integer,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
