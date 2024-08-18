# Lorapi

- Lorapi isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
- Lorapi was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

## About

Lorapi is a [Node.js](https://nodejs.org/en) module for interacting with [League of Runeterra API](https://developer.riotgames.com). The module handles rate limits and includes a caching system.

## Example usage

Install lorapi :

```sh
npm install lorapi
```

Get informations about the status of a region :

```ts
import Lorapi from "lorapi";

const lorapi = new Lorapi("Your RIOT_TOKEN", "EUROPE");

lorapi.getStatus().then(platformData => {
  if (typeof platformData == "string") console.log(`Platform data: ${platformData}`);
  else {
    console.log(`Platform name: ${platformData.name}`)
    console.log(`Platform maintenances: ${platformData.maintenances.length}`)
    console.log(`Platform incidents: ${platformData.incidents.length}`)
  }
})
```

Get game mode and player puuids for a match :

```ts
import Lorapi from "lorapi";

const lorapi = new Lorapi("Your RIOT_TOKEN", "EUROPE");

lorapi.getMatch("MATCH_ID").then(match => {
	if (typeof match == "string") console.log(`Match: ${match}`);
  else {
    console.log(`Game mode: ${match.info.gameMode}`)
    console.log("Player puuids :")
		match.info.players.forEach(player => console.log(`- ${player.puuid}`));
  }
})
```

Get player name and rank in master tier :

```ts
import Lorapi from "lorapi";

const lorapi = new Lorapi("Your RIOT_TOKEN", "EUROPE");

lorapi.getPlayersInMasterTier().then(leaderboard => {
  if (typeof leaderboard == "string") console.log(`Leaderboard: ${leaderboard}`);
  else {
    console.log("Player names :");

    leaderboard.players.forEach(player => console.log(`- ${player.name} (${player.rank})`));
  };
});
```