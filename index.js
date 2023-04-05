const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();
const { IgApiClient } = require("instagram-private-api");
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const username = process.env.INSTA_USERNAME;
const password = process.env.INSTA_PASS;

app.get("/getFollowersCount", async (req, res) => {
  const { youtube, twitch, instagram } = req.query;
  try {
    //fetching instagram followers count
    const ig = new IgApiClient();

    async function login() {
      ig.state.generateDevice(username);
      try {
        await ig.account.login(username, password);
      } catch (err) {
        console.log("Failed to log in to Instagram:", err.message);
        process.exit(1);
      }
    }

    async function getUserId() {
      const user = await ig.user.getIdByUsername(instagram);
      return user;
    }

    async function getFollowersCount() {
      const userId = await getUserId();
      const userInfo = await ig.user.info(userId);
      return userInfo.follower_count;
    }
    let insta_followers = await login().then(() => getFollowersCount());

    // fetching twitch followers count

    const grantType = "client_credentials";
    const scope = "user:read:email";
    //fetching access token
    const accessToken = await axios
      .post("https://id.twitch.tv/oauth2/token", null, {
        params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: grantType,
          scope: scope,
        },
      })
      .then(async (response) => {
        const accessToken = response.data.access_token;
        return accessToken;
      })
      .catch((error) => {
        console.error(error);
      });

    // fetching user id
    const userId = await axios
      .get(`https://api.twitch.tv/helix/users?login=${twitch}`, {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: "Bearer " + accessToken,
        },
      })
      .then((response) => {
        const user = response.data.data[0];
        const userId = user.id;
        return userId;
      })
      .catch((error) => {
        console.log(error.message);
      });

    //fetching follower count based on userId
    const response = await fetch(
      `https://api.twitch.tv/helix/users/follows?to_id=${userId}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    let twitchData = "";
    if (response.status === 200) {
      const responseData = await response.json();
      twitchData = responseData.total;
    } else {
      throw new Error(
        `Unable to fetch follower count. Status code: ${response.status}`
      );
    }

    //fetching youtube subscribers count
    const searchResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${youtube}&key=${YOUTUBE_API_KEY}`
    );
    const channelId = searchResponse.data.items[0].id.channelId;

    const channelResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const { subscriberCount } = channelResponse.data.items[0].statistics;
    res.status(200).json({
      twitch: twitchData,
      youtube: subscriberCount,
      instagram: insta_followers,
    });
  } catch (error) {
    console.log(error);
  }
});

app.listen(5000, () => console.log("server listening on port -> 5000"));
