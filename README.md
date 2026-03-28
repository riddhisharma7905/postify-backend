# Postify Backend

This is the backend for the Postify SaaS platform, providing a REST API for authentication, user management, and social media post management.

## 🚀 Features

- **Authentication**: Secure registration and login using JWT.
- **Post Management**: Full CRUD operations for creating, reading, updating, and deleting posts.
- **User Management**: Author profiles, follow/unfollow functionality, and dashboard analytics.
- **NLP Integration**: Basic natural language processing for sentiment analysis or content categorization.
- **Database**: MongoDB integration with Mongoose.

## 🛠 Tech Stack

- **Node.js**: JavaScript runtime environment.
- **Express**: Fast, unopinionated, minimalist web framework.
- **MongoDB**: NoSQL database.
- **Mongoose**: Elegant mongodb object modeling for node.js.
- **JSON Web Tokens (JWT)**: For secure authentication.
- **Cors**: Middleware to enable Cross-Origin Resource Sharing.
- **Dotenv**: For managing environment variables.

## ⚙️ Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd backend1
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root of the `backend1` directory and add the following:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CLIENT_ORIGIN=http://localhost:3000
   ML_URL=http://localhost:5002
   ```

4. **Start the server**:
   ```bash
   npm start
   ```
   The server will start running on `http://localhost:5001`.

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Create a new user.
- `POST /api/auth/login` - Authenticate a user.

### Users
- `GET /api/user/profile/:id` - Fetch user profile.
- `PUT /api/user/update` - Update user information.

### Posts
- `GET /api/posts` - List all posts.
- `GET /api/posts/:id` - Get a single post.
- `POST /api/posts` - Create a new post.
- `PUT /api/posts/:id` - Update a post.
- `DELETE /api/posts/:id` - Delete a post.

## 📄 License

This project is licensed under the ISC License.
