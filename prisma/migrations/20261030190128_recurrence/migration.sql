-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rrule" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "rrule" TEXT;

-- CreateTable
CREATE TABLE "TaskException" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "date" DATE,

    CONSTRAINT "TaskException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventException" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,

    CONSTRAINT "EventException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskException_taskId_occurrenceDate_key" ON "TaskException"("taskId", "occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "EventException_eventId_occurrenceStart_key" ON "EventException"("eventId", "occurrenceStart");

-- AddForeignKey
ALTER TABLE "TaskException" ADD CONSTRAINT "TaskException_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventException" ADD CONSTRAINT "EventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
