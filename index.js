// The .env package is used to load environment variables from a .env file into the process.env object in Node.js. 
require("dotenv").config(); 

// const config = require("./config.json");
const mongoose = require("mongoose");
mongoose.connect(process.env.connectionString);
const PORT = process.env.PORT

const User = require("./models/user.model");
const Note = require("./models/note.model");

const express = require("express");
// The cors package allows you to specify which domains are allowed to access your server's resources.
const cors = require("cors");

const app = express();
// JWTs are widely used for authentication and authorization purposes in modern web applications.
const jwt = require("jsonwebtoken");
const {authenticateToken} = require("./utilities");
app.use(express.json());

// To allow all requests , we use '*' (It can be accessed by anyone)
app.use(
    cors({
        origin:"*",
    })
);

app.get("/", (req,res) => {
    res.json({data:"Hello"});
})

// CREATE ACCOUNT

app.post("/create-account", async (req,res) => {
    const {fullName, email, password} = req.body;
    if(!fullName){
        return res
        .status(400)
        .json({error:true,message:"Full name is required"});
    }
    if(!email){
        return res
        .status(400)
        .json({error:true,message:"Email is required"});
    }
    if(!password){
        return res
        .status(400)
        .json({error:true,message:"Password is required"});
    }

    const isUser = await User.findOne({email:email});
    if(isUser){
        return res.json({
            error: true,
            message: "User already exists",
        });
    }
    const user = new User({
        fullName, email, password,
    });
    await user.save();
    
    const accessToken = jwt.sign({user}, process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:"36000m",
    });

    return res.json({
        error:false,
        user,
        accessToken,
        message: "Registration Successful",
    })

});

// LOGIN

app.post("/login", async(req,res) => {
    const { email, password} = req.body;

    if(!email){
        return res
        .status(400)
        .json({message:"Email is required"});
    }
    if(!password){
        return res
        .status(400)
        .json({message:"Password is required"});
    }

    const userInfo = await User.findOne({email:email});

    if(!userInfo){
        return res.status(400).json({message: "User not found"});
    }

    if(userInfo.email == email && userInfo.password == password){
        const user = {user: userInfo};
        // Object = {key : value}
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn:"36000m",
        });

        return res.json({
            error: false,
            message: "Login Successful",
            email,
            accessToken,
        })
    }
    else{
        return res.status(400).json({error: true,
            message: "Invalid Credentials",
        })
    }
})

//Get User

app.get("/get-user", authenticateToken, async(req,res) => {
    //autheticateToken is middleware that verifies the JWT token, extracts user information, and attaches it to req.user.
    const { user } = req.user;
    const isUser = await User.findOne({_id:user._id});

    if(!isUser){
        return res.sendStatus(401);
    }
    return res.json({
        user: {
            fullName: isUser.fullName,
            email: isUser.email,
            _id: isUser._id,
            createdOn: isUser.createdOn,
        },
        message: "",
    })
})


// Add Note

app.post("/add-note", authenticateToken, async(req,res) => {
    const {title, content} =req.body;
    console.log("request - body : " ,req.body);
    const { user } = req.user;

    // const userId = req.user?.userId;  // Access userId from req.user safely
    // if (!userId) {
    //     return res
    //     .status(400).
    //     json({ error: true, message: "User authentication failed" });
    // }
    // const userId = req.user?._id; 
    // if (!userId) {
    //     return res.status(400).json({ error: true, message: "User authentication failed" });
    // }


    if(!title){
        return res
        .status(400)
        .json({error : true, message:"Title is required"});
    }
    if(!content){
        return res
        .status(400)
        .json({error : true, message:"Content is required"});
    }
    
    try{
        const note = new Note({
            title,
            content,
            userId:user._id,
        })

        await note.save();

        return res.json({
            error:false,
            note, 
            message: "Note added successfully",
        });
    }
    catch(error){
        console.error("Error saving note:", error);  // Log the error here
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        });
    }

})

// Edit Notes

app.put("/edit-note/:noteId", authenticateToken, async(req,res) => {
    const noteId = req.params.noteId;
    const {title, content} =req.body;
    const { user } = req.user;

    if(!title && !content){
        return res
        .status(400)
        .json({error : true, message:"No changes provided"});
    }
    
    try{
        const note = await Note.findOne({
            _id: noteId,
            userId :user._id,
        })
        
        if(!note){
            return res
            .status(400)
            .json({error : true, message:"Note not found"});
        }

        if(title) note.title = title;
        if(content) note.content = content;

        await note.save();

        return res.json({
            error:false,
            note, 
            message: "Note updated successfully",
        });
    }
    catch(error){
        return res.status(500).json({
            error:true,
            message: "Internal Server Error",
        })
    }

})

// Get All Notes

app.get("/get-all-notes",authenticateToken,async(req,res) => {
    const { user } = req.user;

    try{
        const notes = await Note.find({userId: user._id});

        return res.json({
            error: false,
            notes,
            message: "All notes retrieved successfully",
        });
    }
    catch(error){
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        })
    }
})

// Delete Note

app.delete("/delete-note/:noteId",authenticateToken,async(req,res) => {
    const noteId = req.params.noteId;
    const { user } = req.user;

    try{
        const note = await Note.findOne({_id: noteId, userId: user._id});

        if(!note){
            res.status(404).json({error:true, message : "Note not found"});
        }
        await Note.deleteOne({_id: noteId, userId: user._id});

        return res.json({
            error: false,
            message: "Note deleted successfully",
        });
    }
    catch(error){
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        })
    }
})

// UPDATE isPinned Value

app.put("/update-note-pinned/:noteId", authenticateToken, async(req,res) => {
    const noteId = req.params.noteId;
    const {isPinned} =req.body;
    const { user } = req.user;
    
    try{
        const note = await Note.findOne({
            _id: noteId,
            userId :user._id,
        })
        
        if(!note){
            return res
            .status(400)
            .json({error : true, message:"Note not found"});
        }

        note.isPinned = isPinned;

        await note.save();

        return res.json({
            error:false,
            note, 
            message: "Note updated successfully",
        });
    }
    catch(error){
        return res.status(500).json({
            error:true,
            message: "Internal Server Error",
        })
    }

})

// Search Notes

app.get("/search-notes", authenticateToken, async(req,res) => {

    const {user} = req.user;
    const {query} = req.query;

    if(!query ){
        return res
        .status(400)
        .json({error:true, message : "Search query is required"});
    }
    try{
        const matchingNotes = await Note.find({
            userId: user._id,

        //$or: [...]: Uses the $or operator to specify that at least one of the conditions inside the array must be true.
        // { title: { $regex: new RegExp(query, "i") } }: Searches for notes where the title field matches the regular expression created from query. The "i" flag makes the search case-insensitive.
            $or: [
                {title:{$regex: new RegExp(query, "i")}},
                {content: { $regex: new RegExp(query, "i")}}
            ],
        });

        return res.json({
            error:false,
            notes: matchingNotes,
            message: "Notes matching the search query retrived successfully",
        })
    }catch(error){
        return res.status(500).json({
            error: true,
            message: "Internal Server Error",
        })
    }
})

const port = `${PORT}`;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;