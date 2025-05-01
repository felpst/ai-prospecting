import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  saved_companies: [{
    type: String,  // Reference to company.id
    ref: 'Company'
  }]
}, {
  timestamps: true
});

// Export the model
const User = mongoose.model('User', userSchema);
export default User; 