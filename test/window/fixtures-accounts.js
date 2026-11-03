// fixtures-accounts.js: the two test accounts the window tests (scen.js) are built on: trainer2, a Gengar hunting the Alakazam temple at 640 kills/h, and trainer4, a Charmeleon hunting the Vileplume woods at 600 kills/h.
// (They used to be read from the retired "Where to hunt" test; these are the very same values.)
module.exports = {
  V2: {
    "live": true,
    "active": true,
    "minutes": 600,
    "sessionTime": "10h",
    "name": "trainer2",
    "level": 132,
    "startedAt": 2,
    "huntId": "psychic-100",
    "defeated": 6400,
    "killsH": 640,
    "partySize": 1,
    "lead": {
      "speciesId": 94,
      "level": 130,
      "quality": 1.2,
      "growth": {
        "hp": 20,
        "atk": 20,
        "def": 20,
        "spa": 24,
        "spd": 20,
        "spe": 24
      }
    }
  },
  V4: {
    "live": true,
    "active": true,
    "minutes": 600,
    "sessionTime": "10h",
    "name": "trainer4",
    "level": 123,
    "startedAt": 4,
    "huntId": "grass-60",
    "defeated": 1000,
    "killsH": 600,
    "partySize": 1,
    "lead": {
      "speciesId": 5,
      "level": 94,
      "quality": 1.33,
      "growth": {
        "hp": 20,
        "atk": 20,
        "def": 20,
        "spa": 22,
        "spd": 20,
        "spe": 22
      }
    }
  }
};
