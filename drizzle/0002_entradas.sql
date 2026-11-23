ALTER TABLE bookings ADD COLUMN ticket TEXT;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN admitted TEXT;
--> statement-breakpoint
UPDATE bookings SET ticket=lower(hex(randomblob(16))) WHERE status='pagada';
--> statement-breakpoint
CREATE UNIQUE INDEX bookings_ticket ON bookings(ticket);
