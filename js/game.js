
var can = document.getElementById("canvas")
var ctx = can.getContext("2d")

var always = ( function () {
	/*
		Contract functions.
		Return a value if it meets criteria, otherwise throws an error.
	*/

	return {
		'whole':
			whole => {
				// Is a number a whole number that isn't NaN?

				if (whole === whole && whole % 1 === 0) {
					return whole
				} else {
					throw new TypeError(
						"The contract always.whole was broken with the value " + whole + ".\n" +
						"Calling function was " + arguments.callee.caller.toString() + ".\n")
				}
			},
		'numeric':
			numeric => {
				if (numeric === numeric) {
					return numeric
				} else {
					throw new TypeError(
						"The contract always.numeric was broken with the value " + numeric + ".\n" +
						"Calling function was " + arguments.callee.caller.toString() + ".\n")
				}
			},
		'boolean':
			boolean => {
				if (boolean === false || boolean === true) {
					return boolean
				} else {
					throw new TypeError(
						"The contract always.boolean was broken with the value " + boolean + ".\n" +
						"Calling function was " + arguments.callee.caller.toString() + ".\n")
				}
			},
		'func':
			func => {
				if (func && typeof func === 'function') {
					return func
				} else {
					throw new TypeError(
						"The contract always.func was broken with the value " + func + ".\n" +
						"Calling function was " + arguments.callee.caller.toString() + ".\n")

				}
			}
	}

} )()




var constants = ( function () {

	var self = {}

	self.steps = 1

	// let the sidescroll be a function of time.
	self.dx = (1.8) + (0.5 * self.steps)

	self.cloud = {
		"width": 140,
		"height": 140 / Math.pow(1.613, 3),
		"cloudFrequency": 1/10
	}
	self.bounds = {
		'x0': -self.cloud.width,
		'x1': can.width + self.cloud.width,
		'y0': -50,
		'y1': can.height + 50,
	}

	self.gravity = 9.8 / 60,

	self.colours = {
		"blue": "#3498db",
		"white": "#ecf0f1",
		"black": "black"
	}

	self.hero = {
		"width": 32,
		"height": 32
	}
	self.score = {
		"x0": 100,
		"y0": 50
	}
	self.frameTime =
		1/60

	self.asMagnitude =
		(interval) => {
			return 5.5  * Math.log(interval / 25)
		}

	self.asVelocity =
		velocity => {
			var terminalVelocity = 8

			if (velocity > 0) {
				return Math.min(velocity, terminalVelocity)
			} else {
				return Math.max(velocity, -terminalVelocity)
			}
		}

	return self
} )()

var keyCodes = {
	'space': 32
}

var utils = {
	'timer':
		milliseconds => {

			var genesis = (new Date).getTime()

			return function () {
				always.numeric((new Date).getTime() > (genesis + milliseconds))
			}
		},
	'trueWithOdds':
		prob => {
			return always.numeric(Math.random() < prob)
		},
	'randBetween':
		(lower, upper) => {
			return always.numeric((Math.random() * (upper-lower)) + lower)
		},
	'flatmap':
		(coll, fn) => {

			var out = []

			for (var ith = 0; ith < coll.length; ith++) {
				out = out.concat( fn(coll[ith]) )
			}

			return out
		}
}

const FlyingMotion = self => {
	return step => {

		return {
			x0: always.numeric(self.initialX0),
			x1: always.numeric(self.initialX1),

			y0: always.numeric(self.initialY0 + 7 * Math.sin(step / 10)),
			y1: always.numeric(self.initialY1 + 7 * Math.sin(step / 10))
		}

	}
}

const StandingMotion = self => {
	return step => {

		return {
			x0: always.numeric( self.x0 - (constants.dx * (step - self.init)) ) ,
			x1: always.numeric( self.x1 - (constants.dx * (step - self.init)) ) ,

			y0: always.numeric(self.y0) ,
			y1: always.numeric(self.y1)
		}
	}
}

const FallingMotion = self => {
	return step => {
		/*
			given an initial v→ generate a function giving
			the players position at a given step. This closed form
			makes it easier to raycast collisions.
		*/

		const time = step - self.init

		return {
			x0: always.numeric(self.x0 + self.vx * time + 0.5 * self.ax * (time * time)),
			x1: always.numeric(self.x1 + self.vx * time + 0.5 * self.ax * (time * time)),

			y0: always.numeric(self.y0 + self.vy * time + 0.5 * self.ay * (time * time)),
			y1: always.numeric(self.y1 + self.vy * time + 0.5 * self.ay * (time * time))
		}
	}
}

const Cloud = self => {
	return step => {

		return {
			x0: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) ),
			x1: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) + constants.cloud.width ),

			y0: always.numeric(self.y0),
			y1: always.numeric(self.y1),

			cloudId: always.whole(self.cloudId)
		}
	}
}


// the initial state
var state = {
	'cloudIsReady':
		function () {return true},

	'clouds': [],
	'hero':
		{
			position: FlyingMotion({
				initialX0: 200,
				initialX1: 200 + constants.hero.width,

				initialY0: 200,
				initialY1: 200 + constants.hero.height
			}),

			angle: 0,

			// will be reduntant; motion will be a function soon.

			isDead:
				false,

			positionType:
				'flying',

			last: -1,

			jumpStart: {

			}
		},

	// reactions are temporally ordered.
	'reactions': [],
	'score':
		{
			value: 0,
			x0: constants.score.x0,
			y0: constants.score.y0
		},
	'nextCloud': 0,
	'steps': 0
}

var react = {
	"addClouds":
		state => {

			state.clouds = state.clouds.concat( ( function () {

				const init = state.steps

				const y0 = utils.randBetween(
					1 / 10 * constants.bounds.y1,
					2 / 3 * constants.bounds.y1)

				const y1 = y0 + constants.cloud.height

				return Cloud({
					init: always.whole(state.steps),
					y0: always.numeric(y0),
					y1: always.numeric(y1),
					cloudId: always.whole(state.nextCloud)
				})

			} )() )

			state.nextCloud = always.whole(state.nextCloud + 1)

			return state
		},
	"removeOldClouds":
		state => {

			state.clouds = state.clouds.filter(function (cloud) {
				return always.boolean(cloud(state.steps).x0 > constants.bounds.x0)
			})

			return state
		},
	"clipWings":
		state => {
			/*
				transition from the flying state to the falling state.
			*/

			var hero = state.hero

			if (hero.positionType === "flying") {
				hero.positionType = 'falling'
			}

			const coords = hero.position(state.steps)

			hero.position = always.func( FallingMotion({
				'x0': coords.x0,
				'x1': coords.x1,
				'y0': coords.y0,
				'y1': coords.y1,

				'vx': 0,
				'vy': 0,

				'ax': 0,
				'ay': constants.gravity,

				'init': state.steps
			}) )

			state.hero = hero

			return state
		},
	'endGame':
		state => {
			/*
				check if the player is offscreen,
				and if he or she is append an event.
			*/

			state.hero.isDead = true

			return state
		},
	'beginJumpPowerup':
		time => {
			return state => {
				/*
					register that we are getting ready to jump.
				*/

				var hero = state.hero

				if (hero.positionType === 'standing' || hero.positionType === "falling") {
					hero.jumpStart = {
						'time': time
					}
				}
				state.hero = hero

				return state
			}
		},
	'jump':
		function (x, y, time) {
			/*
				jump.
			*/
			return state => {

				if (state.hero.positionType !== "standing") {
					return state
				}

				var magnitude = constants.asMagnitude(time - state.hero.jumpStart.time)
				var hero = state.hero

				var mouse = {
					'x': x - canvas.offsetLeft,
					'y': y - canvas.offsetTop
				}

				var dist = {
					'x': mouse.x - hero.x1,
					'y': mouse.y - hero.y1
				}

				var angle = Math.atan(dist.y / dist.x)

				var velocities = {
					'x':
						constants.asVelocity( magnitude * Math.cos(angle) ),
					'y':
						constants.asVelocity( magnitude * Math.sin(angle) )
				}

				hero.vx = velocities.x
				hero.vy = velocities.y

				hero.y0 = always.numeric(hero.y0 - 1)
				hero.y1 = always.numeric(hero.y1 - 1)

				hero.positionType = 'falling'
				hero.jumpStart = {}

				state.hero = hero

				return state
			}
		}


}

const currently = {
	'isCloudy':
		state => {
			return state.clouds.length > 0
		},
	'offscren':
		state => {

			const coords = state.hero.position( state.steps )

			const isOffscreen = coords.y1 > constants.bounds.y1 ||
				coords.x0 < constants.bounds.x0 ||
				coords.x1 > constants.bounds.x1

			return isOffscreen
		},
	'flying':
		state => {
			return state.hero.positionType === 'flying'
		},
	'falling':
		state => {
			return state.hero.positionType === 'falling'
		}
}

var _update = state => {
	/*
	given the state at t, calculate the state at t + dt
	*/

	const when = (condition, reaction) => {
		// side effectfully update state
		if (condition(state)) {
			state.reactions = state.reactions.concat([reaction])
		}
	}

	when(state => {
		return Math.random() > 0.995
	}, react.addClouds)

	when(currently.isCloudy, react.removeOldClouds)

	when(currently.offscren, react.endGame)


	when(currently.falling, react.addGravity)

	when(state => {
		// is the hero standing?
		return state.hero.positionType !== 'falling'
	}, react.standStill)

	/*
		consume every event in the queue, in order.
	*/

	for (var ith = 0; ith < state.reactions.length; ith++) {
		var reaction = state.reactions[ith]

		state = always.func(reaction)(state)

	}
	state.reactions = []
	state.steps += 1

	return state
}

const draw = ( function () {
	/*
		returns a function that takes the current state,
		and draws each entity that needs to be drawn.
	*/

	const drawCloud = state => {

		ctx.fillStyle = constants.colours.white

		state.clouds.forEach(cloud => {

			var coords = cloud(state.steps)

			ctx.fillRect(coords.x0, coords.y0, constants.cloud.width, constants.cloud.height)
		})
	}

	const drawHero = state => {

		var hero = state.hero
		var birdy = document.getElementById("bird-asset")

		if (hero.jumpStart.time) {
			ctx.fillStyle = constants.colours.black
		} else {
			ctx.fillStyle = constants.colours.white
		}

		const coords = hero.position(state.steps)

		ctx.drawImage(birdy, coords.x0, coords.y0)
	}

	const drawScore = state => {
		// draw the score to the corner of the screen.

			ctx.font = "30px Monospace"

		ctx.fillText(
			state.score.value + "",
			constants.score.x0, constants.score.y0)

	}

	const drawDeathScreen =	state => {

		ctx.fillStyle = 'rgba(0,0,0,0.6)'

		ctx.fillRect(
			constants.bounds.x0, constants.bounds.y0,
			constants.bounds.x1, constants.bounds.y1)

		ctx.fillStyle = constants.colours.blue

		ctx.fillRect(
			constants.bounds.x0, 200,
			constants.bounds.x1, 100)

		ctx.font = "20px Monospace"

		ctx.fillStyle = constants.colours.white

		value = state.score.value

		if (value < 3) {
			var message = "Try Harder. Score: " + value
		} 	else if (value < 10) {
			var message = ". Score: " + value
		} else {
			var message = "Well done. Score: " + value
		}

		ctx.fillText(
			"You ran out of cluck. " +
			"Score: " + state.score.value,
			constants.score.x0, 265)
	}

	return state => {
		/*
			given the current state draw each entity to the screen.
		*/

		canvas.width = canvas.width

		drawCloud(state)

		drawHero(state)
		drawScore(state)

		ctx.stroke();
	}

} )()


window.addEventListener('keydown', event => {
	if (event.keyCode === keyCodes.space) {

		state.reactions =
			state.reactions.concat([react.clipWings])

	}
})
window.addEventListener('mousedown', event => {

	state.reactions =
		state.reactions.concat([react.beginJumpPowerup((new Date).getTime() )])
})

window.addEventListener('mouseup', event => {

	state.reactions =
		state.reactions.concat([react.jump(
			event.pageX, event.pageY, (new Date).getTime() )])
})


var loop = function () {
	/*
		repeatedly update the state.
	*/

	if (!state.hero.isDead) {
		state = _update(state);
		draw(state)
	} else {
		clearInterval(GAMEID)
	}
}

var GAMEID = setInterval(loop, 1000 / 60)
