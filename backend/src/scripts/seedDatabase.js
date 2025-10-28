const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB } = require('../config/database');
const WordList = require('../models/WordList');
const { defaultWordLists } = require('../data/wordLists');

async function seedDatabase() {
  try {
    await connectDB();
    
    console.log('🌱 Starting database seeding...');

    // Clear existing word lists (only default ones)
    await WordList.deleteMany({ isCustom: false });
    console.log('✅ Cleared existing default word lists');

    // Insert default word lists
    const insertedWordLists = await WordList.insertMany(defaultWordLists);
    console.log(`✅ Inserted ${insertedWordLists.length} default word lists`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\nInserted word lists:');
    insertedWordLists.forEach(list => {
      console.log(`  - ${list.name} (${list.wordCount} words)`);
    });

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}
// mongodb+srv://rengoku:admin123@cluste
// r0.fu2qi6k.mongodb.net/twitter?retryWrites=true&w=majority
module.exports = seedDatabase;