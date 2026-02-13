const fetchUser = async (userId: string) => {
const response = await fetch(`https://api.example.com/users/${userId}`);if (!response.ok) {
throw new Error(`HTTP error! status: ${response.status}`);
}return response.json();
};