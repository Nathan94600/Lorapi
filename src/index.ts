// Constants

const BASE_URL = ".api.riotgames.com/lor/"

// Functions

function updateRateLimit(rateLimit: RateLimits[Region], funcName: FunctionName, headers: Headers) {
	const [firstAppRateLimit, firstAppRateLimitTime, secondAppRateLimit, secondAppRateLimitTime] = headers.get("x-app-rate-limit")?.split("").flatMap(v => v.split("")) || [],
	[firstAppRateCount, firstAppRateCountTime, secondAppRateCount, secondAppRateCountTime] = headers.get("x-app-rate-count")?.split("").flatMap(v => v.split("")) || [],
	[methodRateLimit, methodRateLimitTime] = headers.get("x-method-rate-limit")?.split("") || [],
	[methodRateCount, methodRateCountTime] = headers.get("x-method-rate-limit-count")?.split("") || [],
	firstAppTime = (firstAppRateCountTime || firstAppRateLimitTime),
	secondAppTime = (secondAppRateCountTime || secondAppRateLimitTime),
	methodTime = (methodRateCountTime || methodRateLimitTime);

	if (firstAppRateCount) rateLimit.app[0].count = parseInt(firstAppRateCount);
	if (secondAppRateCount) rateLimit.app[1].count = parseInt(secondAppRateCount);
	if (methodRateCount) rateLimit[funcName].count = parseInt(methodRateCount);

	if (firstAppRateLimit) rateLimit.app[0].max = parseInt(firstAppRateLimit);
	if (secondAppRateLimit) rateLimit.app[1].max = parseInt(secondAppRateLimit);
	if (methodRateLimit) rateLimit[funcName].max = parseInt(methodRateLimit);

	if (!rateLimit.app[0].timeout && firstAppTime) rateLimit.app[0].timeout = setTimeout(() => {
		rateLimit.app[0].count = 0;
		rateLimit.app[0].timeout = null;
	}, parseInt(firstAppTime) * 1000)
	if (!rateLimit.app[1].timeout && secondAppTime) rateLimit.app[1].timeout = setTimeout(() => {
		rateLimit.app[1].count = 0;
		rateLimit.app[1].timeout = null;
	}, parseInt(secondAppTime) * 1000)
	if (!rateLimit[funcName].timeout && methodTime) rateLimit[funcName].timeout = setTimeout(() => {
		rateLimit[funcName].count = 0;
		rateLimit[funcName].timeout = null;
	}, parseInt(methodTime) * 1000)
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getStatus(cache: Cache, rateLimits: RateLimits, region: Region, riotToken: string): Promise<PlatformData | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.status[region];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue);
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getStatus.count >= rateLimit.getStatus.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}status/v1/platform-data`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getStatus", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getStatus(cache, rateLimits, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (Array.isArray(json) || typeof json !== "object") reject({ reason: "Bad response type", value: json });
					else if (!json.players) reject({ reason: "Missing properties", value: json });
					else {
						const platformData: PlatformData = {
							id: json.id,
							incidents: json.incidents.map((incident: ApiStatus) => ({
								id: incident.id,
								maintenanceStatus: incident.maintenance_status,
								incidentSeverity: incident.incident_severity,
								titles: incident.titles.map((title: Content) => ({ content: title.content, locale: title.locale })),
								updates: incident.updates?.map((update: ApiUpdate) => ({
									author: update.author,
									createdAt: update.created_at,
									id: update.id,
									publish: update.publish,
									publishLocations: update.publish_locations,
									translations: update.translations.map((translation: Content) => ({ content: translation.content, locale: translation.locale })),
									updateAt: update.updated_at,
								})),
								createdAt: incident.created_at,
								archiveAt: incident.archive_at,
								updatedAt: incident.updated_at,
								platforms: incident.platforms
							})),
							locales: json.locales,
							maintenances: json.maintenaces.map((maintenance: ApiStatus) => ({
								id: maintenance.id,
								maintenanceStatus: maintenance.maintenance_status,
								incidentSeverity: maintenance.incident_severity,
								titles: maintenance.titles.map((title: Content) => ({ content: title.content, locale: title.locale })),
								updates: maintenance.updates?.map((update: ApiUpdate) => ({
									author: update.author,
									createdAt: update.created_at,
									id: update.id,
									publish: update.publish,
									publishLocations: update.publish_locations,
									translations: update.translations.map((translation: Content) => ({ content: translation.content, locale: translation.locale })),
									updateAt: update.updated_at,
								})),
								createdAt: maintenance.created_at,
								archiveAt: maintenance.archive_at,
								updatedAt: maintenance.updated_at,
								platforms: maintenance.platforms
							})),
							name: json.name,
						};

						cache.status[region] = { ...platformData, lastUpdate: Date.now() };
						
						resolve(platformData);
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getPlayersInMasterTier(cache: Cache, rateLimits: RateLimits, region: Region, riotToken: string): Promise<Leaderboard | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.playersInMasterTier[region];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue);
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getPlayersInMasterTier.count >= rateLimit.getPlayersInMasterTier.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}ranked/v1/leaderboards`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getPlayersInMasterTier", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getPlayersInMasterTier(cache, rateLimits, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (Array.isArray(json) || typeof json !== "object") reject({ reason: "Bad response type", value: json });
					else if (!json.players) reject({ reason: "Missing properties", value: json });
					else {
						const players: Leaderboard = json.players.map((player: Player) => ({ name: player.name, rank: player.rank, lp: player.lp }));

						cache.playersInMasterTier[region] = { ...players, lastUpdate: Date.now() };
						
						resolve(players);
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getMatch(cache: Cache, rateLimits: RateLimits, matchId: string, region: Region, riotToken: string): Promise<Match | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.match[region][matchId];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue);
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getMatch.count >= rateLimit.getMatch.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}match/v1/matches/${matchId}`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getMatch", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getMatch(cache, rateLimits, matchId, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (Array.isArray(json) || typeof json !== "object") reject({ reason: "Bad response type", value: json });
					else if (!json.info || !json.metadata) reject({ reason: "Missing properties", value: json });
					else {
						const match: Match = {
							info: {
								gameFormat: json.info.game_format,
								gameMode: json.info.game_mode,
								gameStartTimeUtc: json.info.game_start_time_utc,
								gameType: json.info.game_type,
								gameVersion: json.info.game_version,
								players: json.info.players.map((player: ApiMatchPlayer) => new PlayerMatches({
									puuid: player.puuid, deckId: player.deck_id, deckCode: player.deck_code, factions: player.factions, gameOutcome: player.game_outcome, orderOfPlay: player.order_of_play
								}, cache, rateLimits, region, riotToken)),
								totalTurnCount: json.info.total_turn_count
							},
							metadata: { dataVersion: json.metadata.data_version, matchId: json.metadata.match_id, participants: json.metadata.participants },
						};

						cache.match[region][matchId] = { ...match, lastUpdate: Date.now() };
						
						resolve(match);
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getPlayerMatches(cache: Cache, rateLimits: RateLimits, puuid: string, region: Region, riotToken: string): Promise<PlayerMatch[] | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.playerMatchIds[region][puuid];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue.ids.map(id => new PlayerMatch(id, cache, rateLimits, region, riotToken)));
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getPlayerMatches.count >= rateLimit.getPlayerMatches.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}match/v1/matches/by-puuid/${puuid}/ids`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getPlayerMatches", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getPlayerMatches(cache, rateLimits, puuid, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (!Array.isArray(json)) reject({ reason: "Bad response type", value: json });
					else {
						cache.playerMatchIds[region][puuid] = { ids: json, lastUpdate: Date.now() };
						
						resolve(json.map(id => new PlayerMatch(id, cache, rateLimits, region, riotToken)));
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getInventory(cache: Cache, rateLimits: RateLimits, authorization: string, region: Region, riotToken: string): Promise<Card[] | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.inventory[region][authorization];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue.cards);
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getInventory.count >= rateLimit.getInventory.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}inventory/v1/cards/me?Authorization=${authorization}`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getInventory", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getInventory(cache, rateLimits, authorization, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (!Array.isArray(json)) reject({ reason: "Bad response type", value: json });
					else {
						const cards = json.map(card => ({ code: card.code, count: card.count }));

						cache.inventory[region][authorization] = { cards: cards, lastUpdate: Date.now() };
						
						resolve(cards);
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function getDecks(cache: Cache, rateLimits: RateLimits, authorization: string, region: Region, riotToken: string): Promise<Deck[] | string> {
	return new Promise((resolve, reject) => {
		const rateLimit = rateLimits[region], cacheValue = cache.decks[region][authorization];

		if (cacheValue?.lastUpdate && cacheValue.lastUpdate + 300000 <= Date.now()) resolve(cacheValue.decks);
		else if (rateLimit.app[0].count >= rateLimit.app[0].max || rateLimit.app[1].count >= rateLimit.app[1].max) reject("App Rate Limit");
		else if (rateLimit.getDecks.count >= rateLimit.getDecks.max) reject("Method Rate Limit");
		else fetch(`https://${region.toLowerCase()}${BASE_URL}deck/v1/decks/me?Authorization=${authorization}`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
			const retryAfterHeader = res.headers.get("retry-after");

			updateRateLimit(rateLimit, "getDecks", res.headers);

			if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await getDecks(cache, rateLimits, authorization, region, riotToken)), parseInt(retryAfterHeader) * 1000);
			else res.json().then(json => {
				if (res.status.toString()[0] == "2") {
					if (!Array.isArray(json)) reject({ reason: "Bad response type", value: json });
					else {
						const decks = json.map(deck => ({ id: deck.id, name: deck.name, code: deck.code }));

						cache.decks[region][authorization] = { decks: decks, lastUpdate: Date.now() };
						
						resolve(decks);
					}
				} else reject(json);
			}, () => res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text)))
		}, reason => reject(reason))
	})
}

/**
 * @param riotToken See https://developer.riotgames.com/
 */
function createDeck(newDeck: NewDeck, authorization: string, region: Region, riotToken: string): Promise<string> {
	return new Promise((resolve, reject) => fetch(`https://${region.toLowerCase()}${BASE_URL}deck/v1/decks/me?Authorization=${authorization}`, { method: "GET", headers: { "X-Riot-Token": riotToken } }).then(res => {
		const retryAfterHeader = res.headers.get("retry-after");

		if (retryAfterHeader && res.status == 429) setTimeout(async () => resolve(await createDeck(newDeck, authorization, region, riotToken)), parseInt(retryAfterHeader) * 1000);
		else res.text().then(text => (res.status.toString()[0] == "2" ? resolve : reject)(text));
	}, reason => reject(reason)))
}

// Classes

class PlayerMatches {
	constructor(matchPlayer: MatchPlayer, cache: Cache, rateLimits: RateLimits, region: Region, riotToken: string) {
		this.puuid = matchPlayer.puuid;
		this.deckCode = matchPlayer.deckCode;
		this.deckId = matchPlayer.deckId;
		this.factions = matchPlayer.factions;
		this.gameOutcome = matchPlayer.gameOutcome;
		this.orderOfPlay = matchPlayer.orderOfPlay;
		this.cache = cache;
		this.rateLimits = rateLimits;
		this.region = region;
		this.riotToken = riotToken;
	}

	puuid: string;
	deckId: string;
	/**
	 * Code for the deck played. Refer to LOR documentation for details on deck codes.
	 */
	deckCode: string;
	factions: string[];
	gameOutcome: string;
	/**
	 * The order in which the players took turns.
	 */
	orderOfPlay: number;

	private readonly cache: Cache;
	private readonly rateLimits: RateLimits;
	private readonly region: Region;
	private readonly riotToken: string;

	matches() { return getPlayerMatches(this.cache, this.rateLimits, this.puuid, this.region, this.riotToken) };
};

class PlayerMatch {
	constructor(matchId: string, cache: Cache, rateLimits: RateLimits, region: Region, riotToken: string) {
		this.id = matchId;
		this.cache = cache;
		this.rateLimits = rateLimits;
		this.region = region;
		this.riotToken = riotToken;
	}

	readonly id: string;
	private readonly cache: Cache;
	private readonly rateLimits: RateLimits;
	private readonly region: Region;
	private readonly riotToken: string;

	match() { return getMatch(this.cache, this.rateLimits, this.id, this.region, this.riotToken) };
};

export default class Lorapi {
	/**
	 * @param riotToken See https://developer.riotgames.com/
	 */
	constructor(riotToken: string, defaultRegion: Region) {
		this.riotToken = riotToken
		this.defaultRegion = defaultRegion

		this.rateLimits = {
			AMERICAS: {
				app: [{ count: 0, max: Infinity, timeout: null }, { count: 0, max: Infinity, timeout: null }],
				getDecks: { count: 0, max: Infinity, timeout: null },
				getInventory: { count: 0, max: Infinity, timeout: null },
				getMatch: { count: 0, max: Infinity, timeout: null },
				getPlayerMatches: { count: 0, max: Infinity, timeout: null },
				getPlayersInMasterTier: { count: 0, max: Infinity, timeout: null },
				getStatus: { count: 0, max: Infinity, timeout: null },
			},
			EUROPE: {
				app: [{ count: 0, max: Infinity, timeout: null }, { count: 0, max: Infinity, timeout: null }],
				getDecks: { count: 0, max: Infinity, timeout: null },
				getInventory: { count: 0, max: Infinity, timeout: null },
				getMatch: { count: 0, max: Infinity, timeout: null },
				getPlayerMatches: { count: 0, max: Infinity, timeout: null },
				getPlayersInMasterTier: { count: 0, max: Infinity, timeout: null },
				getStatus: { count: 0, max: Infinity, timeout: null },
			},
			SEA: {
				app: [{ count: 0, max: Infinity, timeout: null }, { count: 0, max: Infinity, timeout: null }],
				getDecks: { count: 0, max: Infinity, timeout: null },
				getInventory: { count: 0, max: Infinity, timeout: null },
				getMatch: { count: 0, max: Infinity, timeout: null },
				getPlayerMatches: { count: 0, max: Infinity, timeout: null },
				getPlayersInMasterTier: { count: 0, max: Infinity, timeout: null },
				getStatus: { count: 0, max: Infinity, timeout: null },
			}
		}

		this.cache = {
			decks: { AMERICAS: {}, EUROPE: {}, SEA: {} },
			inventory: { AMERICAS: {}, EUROPE: {}, SEA: {} },
			match: { AMERICAS: {}, EUROPE: {}, SEA: {} },
			playerMatchIds: { AMERICAS: {}, EUROPE: {}, SEA: {} },
			playersInMasterTier: { AMERICAS: null, EUROPE: null, SEA: null },
			status: { AMERICAS: null, EUROPE: null, SEA: null },
		}
	}

	private readonly riotToken: string;
	private readonly defaultRegion: Region;
	private readonly rateLimits: RateLimits
	private readonly cache: Cache;

	/**
	 * Get Legends of Runeterra status for the given platform.
	 */
	getStatus(region?: Region) { return getStatus(this.cache, this.rateLimits, region || this.defaultRegion, this.riotToken) };

	/**
	 * Get the players in Master tier.
	 */
	getPlayersInMasterTier(region?: Region) { return getPlayersInMasterTier(this.cache, this.rateLimits, region || this.defaultRegion, this.riotToken) };

	/**
	 * Get match by id
	 */
	getMatch(matchId: string, region?: Region) { return getMatch(this.cache, this.rateLimits, matchId, region || this.defaultRegion, this.riotToken) };

	/**
	 * Get a list of match ids by PUUID
	 */
	getPlayerMatches(puuid: Puuid, region?: Region) { return getPlayerMatches(this.cache, this.rateLimits, puuid, region || this.defaultRegion, this.riotToken) };

	/**
	 * Return a list of cards owned by the calling user.
	 */
	getInventory(authorization: string, region?: Region) { return getInventory(this.cache, this.rateLimits, authorization, region || this.defaultRegion, this.riotToken) };

	/**
	 * Get a list of the calling user's decks.
	 */
	getDecks(authorization: string, region?: Region) { return getDecks(this.cache, this.rateLimits, authorization, region || this.defaultRegion, this.riotToken) };

	/**
	 * Create a new deck for the calling user.
	 */
	createDeck(newDeck: NewDeck, authorization: string, region?: Region) { return createDeck(newDeck, authorization, region || this.defaultRegion, this.riotToken) };
};

// Types

type FunctionName = "getStatus" | "getPlayersInMasterTier" | "getMatch" | "getPlayerMatches" | "getInventory" | "getDecks";

type RateLimits = Record<Region, Record<"app", [RateLimit, RateLimit]> & Record<FunctionName, RateLimit>>;

export type Region = "AMERICAS" | "EUROPE" | "SEA";

export type Puuid = string;

export type MatchIds = string[];

// Interfaces

interface ApiUpdate {
	id: number;
	author: string;
	publish: boolean;
	publish_locations: PublishLocations[];
	translations: Content[];
	created_at: string;
	updated_at: string;
}

interface ApiStatus {
	id: number;
	maintenance_status: MaintenanceStatus;
	incident_severity: IncidentSeverities;
	titles: Content[];
	updates: ApiUpdate[];
	created_at: string;
	archive_at: string;
	updated_at: string;
	platforms: Platforms;
}

interface ApiMatchPlayer {
	puuid: string;
	deck_id: string;
	/**
	 * Code for the deck played. Refer to LOR documentation for details on deck codes.
	 */
	deck_code: string;
	factions: string[];
	game_outcome: string;
	/**
	 * The order in which the players took turns.
	 */
	order_of_play: number;
}

interface Cache {
	status: Record<Region, PlatformData & { lastUpdate: number } | null>;
	playersInMasterTier: Record<Region, Leaderboard & { lastUpdate: number } | null>;
	match: Record<Region, Record<string, Match & { lastUpdate: number } | null>>;
	playerMatchIds: Record<Region, Record<string, { ids: MatchIds; lastUpdate: number; } | null>>;
	inventory: Record<Region, Record<string, { cards: Card[]; lastUpdate: number } | null>>;
	decks: Record<Region, Record<string, { decks: Deck[]; lastUpdate: number } | null>>;
}

interface RateLimit {
	count: number;
	max: number;
	timeout: NodeJS.Timeout | null;
};

export interface NewDeck {
	name: string;
	code: string;
}

export interface PlatformData {
	id: string;
	name: string;
	locales: Languages[];
	maintenances: Status[];
	incidents: Status[];
}

export interface Status {
	id: number;
	maintenanceStatus: MaintenanceStatus;
	incidentSeverity: IncidentSeverities;
	titles: Content[];
	updates: Update[];
	createdAt: string;
	archiveAt: string;
	updatedAt: string;
	platforms: Platforms;
}

export interface Content {
	locale: string;
	content: string;
}

export interface Update {
	id: number;
	author: string;
	publish: boolean;
	publishLocations: PublishLocations[];
	translations: Content[];
	createdAt: string;
	updatedAt: string;
}

export interface Leaderboard {
	/**
	 * A list of players in Master tier.
	 */
	players: Player[];
}

export interface Player {
	name: string;
	rank: number;
	/**
	 * League points.
	 */
	lp: number;
}

export interface Match {
	/**
	 * Match metadata.
	 */
	metadata: Metadata;
	/**
	 * Match info.
	 */
	info: Info;
}

export interface Metadata {
	/**
	 * Match data version.
	 */
	dataVersion: string;
	/**
	 * Match id.
	 */
	matchId: string;
	/**
	 * A list of participant PUUIDs.
	 */
	participants: Puuid[];
}

export interface Info {
	gameMode: GameModes;
	gameType: GameTypes;
	gameStartTimeUtc: string;
	gameVersion: string;
	gameFormat: GameFormats;
	players: PlayerMatches[];
	/**
	 * Total turns taken by both players.
	 */
	totalTurnCount: number;
}

export interface MatchPlayer {
	puuid: Puuid;
	deckId: string;
	/**
	 * Code for the deck played. Refer to LOR documentation for details on deck codes.
	 */
	deckCode: string;
	factions: string[];
	gameOutcome: string;
	/**
	 * The order in which the players took turns.
	 */
	orderOfPlay: number;
}

export interface Card {
	code: string;
	count: string;
}

export interface Deck {
	id: string;
	name: string;
	code: string;
}

// Enums

export enum Platforms {
	Windows = "windows",
	Macos = "macos",
	Android = "android",
	Ios = "ios",
	Ps4 = "ps4",
	Xbone = "xbone",
	Switch = "switch"
}

export enum PublishLocations {
	Riotclient = "riotclient",
	Riotstatus = "riotstatus",
	Game = "game"
}

export enum MaintenanceStatus {
	Scheduled = "scheduled",
	InProgress = "in_progress",
	Complete = "complete"
}

export enum IncidentSeverities {
	Info = "info",
	Warning = "warning",
	Critical = "critical"
}

export enum Languages {
	"German (Germany)" = "de_de",
	"English (United States)" = "en_us",
	"Spanish (Spain)" = "es_es",
	"Spanish (Mexico)" = "es_mx",
	"French (France)" = "fr_fr",
	"Italian (Italy)" = "it_it",
	"Japanese (Japon)" = "ja_jp",
	"Korean (Korea)" = "ko_kr",
	"Polish (Poland)" = "pl_pl",
	"Portuguese (Brazil)" = "pt_br",
	"Thai (Thailand)" = "th_th",
	"Turkish (Turkey)" = "tr_tr",
	"Russian (Russia)" = "ru_ru",
	"Chinese (Taiwan)" = "zh_zw"
}

export enum GameModes {
	Constructed = "Constructed",
	Expeditions = "Expeditions",
	Tutorial = "Tutorial",
}

export enum GameTypes {
	Ranked = "Ranked",
	Normal = "Normal",
	AI = "AI",
	Tutorial = "Tutorial",
	VanillaTrial = "VanillaTrial",
	Singleton = "Singleton",
	StandardGauntlet = "StandardGauntlet",
}

export enum GameFormats {
	Standard = "standard",
	Eternal = "eternal"
}