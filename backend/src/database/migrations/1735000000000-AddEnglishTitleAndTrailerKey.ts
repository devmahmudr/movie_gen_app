import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnglishTitleAndTrailerKey1735000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add english_title column
    await queryRunner.addColumn(
      'movie_history',
      new TableColumn({
        name: 'englishTitle',
        type: 'text',
        isNullable: true,
      }),
    );

    // Add trailer_key column
    await queryRunner.addColumn(
      'movie_history',
      new TableColumn({
        name: 'trailerKey',
        type: 'text',
        isNullable: true,
      }),
    );

    // Add indexes for better performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movie_history_user_movie 
      ON movie_history("userId", "movieId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movie_history_user_shown 
      ON movie_history("userId", "shownAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_movie_history_user_shown;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_movie_history_user_movie;
    `);

    // Remove columns
    await queryRunner.dropColumn('movie_history', 'trailerKey');
    await queryRunner.dropColumn('movie_history', 'englishTitle');
  }
}

