import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWatchedAndNotInterestedColumns1764657759000 implements MigrationInterface {
    name = 'AddWatchedAndNotInterestedColumns1764657759000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns exist before adding (idempotent)
        const table = await queryRunner.getTable("movie_history");
        if (table && !table.findColumnByName("isWatched")) {
            await queryRunner.query(`ALTER TABLE "movie_history" ADD "isWatched" boolean NOT NULL DEFAULT false`);
        }
        if (table && !table.findColumnByName("isNotInterested")) {
            await queryRunner.query(`ALTER TABLE "movie_history" ADD "isNotInterested" boolean NOT NULL DEFAULT false`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movie_history" DROP COLUMN "isNotInterested"`);
        await queryRunner.query(`ALTER TABLE "movie_history" DROP COLUMN "isWatched"`);
    }
}

