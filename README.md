<p align="center">
  <a href="https://github.com/elbkr/ticket-bot">
    <img src="readme/ticket-bot.png" alt="ticket-bot" width="500"/>
  </a>
</p>

 <p align ="center">
   <a href="https://www.jetbrains.com/community/opensource/#support">
    <img src="readme/jb_beam.png" alt="jetbrains" width="25"/>
  </a>  Thanks to <a href="https://www.jetbrains.com/community/opensource/#support">JetBrains</a> for providing me free license for developing this project!
  </p>
  
  
## Features
- Multi guild!
- Open tickets by pressing a button
- Add and remove bot moderators
- Manage tickets by buttons or slash commands
- Manage ticket categories
- Send tickets history
- Log ticket actions
- Much more!

<img src="readme/splash.png" width="3000" alt="splash">

## Contributing
- Want to contribute? Feel free to make any changes you want
1. Fork or clone the repo
2. Make any changes you want (You can also see `todo` file)
3. Open a pull request explaining what changes you've made
4. I ([el bkr](https://github.com/elbkr)) will review it and accept it :D

## Installation

### Requirements
- Node v16 or higher

### Getting the files
1. GitHub CLI: `gh repo clone elbkr/ticket-bot`
2. Download and extract the zip
3. Open with GitHub Desktop

### Creating the application
1. Create an application in [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a BOT and Copy the BOT token
3. Enable all privileged gateway intents
4. Go to OAuth2 and copy the client ID
5. Paste the token at `TOKEN` line and the client ID  at `CLIENT_ID` line in `.env` file
6. Change `REPLACE_THIS` in the URL below with the client ID, and enter the link in your browser

https://discord.com/api/oauth2/authorize?client_id=REPLACE_THIS&permissions=8&scope=applications.commands%20bot

### Connecting to mongo DB
1. Login or register into [Mongo DB](https://account.mongodb.com/account/login)
2. Create a cluster and complete the configuration
3. Get the connection url by pressing on `connect < connect your application`
4. Replace the `password` with your database access password
5. Paste the URL into `.env` file  at `MONGO` line

*The URL looks like this:* `mongodb+srv://username:password@clusterName.pjxpv.mongodb.net/MyFirstDatabase?retryWrites=true&w=majority`

### Getting Pastebin API key
1. Login or register into [Pastebin](https://pastebin.com)
2. Go to https://pastebin.com/doc_api
3. Slide down to **Your Unique Developer API Key** section 
4. Copy the key and paste it into `.env` file  at `PASTE_API_KEY` line

### Changing ticket topics
1. Go to `src/events/interactions/buttonPress.js` file
2. Slide down to the line **127**
3. Change the objects (*See the example below*)
4. Don't forget to also change the topics in `src/commands/tickets/open.js` file

Object example:
```js
{
label: "This will show in the dropdown menu",
value: "value",
emoji: "<:emoji:emoji_id>" // or a simple emoji 🔇
}
```
- For more info on how to get custom emojis ID, check [this guide](https://www.youtube.com/watch?v=srUHwXnw1Jst) I found ;)

### .ENV Output
After the configuration, the `.env` file should look like this:
```env
TOKEN=SuPerReALToken.BelIeVe_Me_itS_ReaL
MONGO=mongodb+srv://username:password@clusterName.pjxpv.mongodb.net/MyFirstDatabase?retryWrites=true&w=majority
CLIENT_ID=521311050193436682
```

### Running the BOT
1. Open a terminal and run `npm install` or `npm i`
2. Run `node .`

## Free hosting
1. Local host
   After the configuration, run `node .` in the terminal (not recommended)
   - It turns off when you turn off the PC
2. Heroku
   - After the configuration, add the files to a GitHub repository
   - Login or register in [Heroku](https://id.heroku.com/login)
   - Create a new app
   - In `deploy` section, press `Connect to GitHub`
   - After connecting, search for the repository and press `connect`
   - Press **Enable automatic deploys** (optional)
   - Click **Deploy Branch**
   - Go to `Resources` section
   - Disable the `web` type and enable `worker` type
