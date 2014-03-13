
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

	self.gravity = 9.8,

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
			always.numeric((Math.random() * (upper-lower)) + lower)
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

var Cloud = step => {
	/*
		a skeleton cloud trajectory function, with
		several variable not yet closed over. Must be called with bind.
	*/

	return {
		x0: always.numeric( constants.bounds.x1 - (constants.dx * (step - this.init)) ),
		x1: always.numeric( constants.bounds.x1 - (constants.dx * (step - this.init)) + constants.cloud.width ),

		y0: always.numeric(this.y0),
		y1: always.numeric(this.y1),

		cloudId: always.whole(this.cloudId)
	}
}

var jumpingHero = t => {
	/*
		given an initial v→ generate a function giving
		the players position at a given step. This closed form
		makes it easier to raycast collisions.
	*/

	return {
		x0: always.numeric(this.initialx0 + this.initialVx * t),
		x1: always.numeric(this.initialx1 + this.initialVx * t),

		y0: always.numeric(this.initialy0 + this.initialVy * t + 0.5 * this.Ay * t^2),
		y1: always.numeric(this.initialy1 + this.initialVy * t + 0.5 * this.Ay * t^2)
	}
}

// the initial state
var state = {
	'cloudIsReady':
		function () {return true},

	'clouds': [],
	'hero':
		{
			x0: 200,
			x1: 200 + constants.hero.width,
			y0: 200,
			y1: 200 + constants.hero.height,
			angle: 0,

			// will be reduntant; motion will be a function soon.
			vx: 0,
			vy: 0,
			ax: 0,
			ay: 0,

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

				var init = state.steps

				var y0 = utils.randBetween(
					1 / 10 * constants.bounds.y1,
					2 / 3 * constants.bounds.y1)

				var y1 = y0 + constants.cloud.height

				var enclosed = {
					init: state.steps,
					y0: y0, y1: y1
				}

				return Cloud.bind({
					init: state.steps,
					y0: y0,
					y1: y1,
					cloudId: state.nextCloud
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

			state.hero = hero

			return state
		},
	'flyAlong':
		state => {
			// bob along like a bird

			var hero = state.hero

			hero.x0 =
				always.numeric(Math.max(hero.x0, 0))
			hero.x1 =
				always.numeric(Math.max(hero.x1, 0))

			var yOffset =
				0.5 * Math.sin(3* hero.angle)

			hero.y0 += yOffset
			hero.y1 += yOffset

			hero.angle =
				hero.angle + 0.05

			state.hero = hero

			return state
		},
	'standStill':
		state => {

			var hero = state.hero

			if (hero.positionType === "standing") {
				hero.x0 = hero.x0 - constants.dx
				hero.x1 = hero.x1 - constants.dx
			}

			state.hero = hero

			return state
		},
	'checkOnPlatform':
		state => {

			var hit = false
			var hero = state.hero

			var match = utils.flatmap(state.clouds, cloud => {

				var coords = cloud(state.steps)

				var xAligned = state.hero.x1 > coords.x0 && state.hero.x0 < coords.x1
				var yAligned = state.hero.y1 > coords.y0 && state.hero.y0 < coords.y1

				var xTooCloseToEdge = hero.x1 < coords.x0 + 5
				var yIncorrectDirection = hero.vy < 0

				if (yAligned && xAligned && xTooCloseToEdge) {
					hit = true
				} else if (xAligned && yAligned && !yIncorrectDirection) {
					return coords
				} else {
					return []
				}
			})

			if (match.length == 0) {
				hero.positionType = 'falling'
			} else if (hit) {
				// reverse the state direction.

				if (hero.vx > 0) {
					hero.vx = -hero.vx
				}

				hero.x0 -= 3
				hero.x1 -= 3

				hero.positionType = "dying"

				hit = false

			} else {
				hero.positionType = 'standing'

				if (hero.last !== match[0].cloudId) {

					state.score.value = state.score.value + 1
					hero.last = match[0].cloudId
				}

				// vertically translate the player, to make
				// stand on platform.
				hero.y0 = match[0].y0 + 1 - constants.hero.height
				hero.y1 = match[0].y0 + 1
			}

			state.hero = hero

			return state
		},
	'addGravity':
		state => {

			var hero = state.hero

			hero.x0 = Math.max(hero.x0 + hero.vx, 0)
			hero.x1 = Math.max(hero.x1 + hero.vx, 0)

			hero.y0 = hero.y0 + hero.vy
			hero.y1 = hero.y1 + hero.vy

			hero.vy = constants.asVelocity(hero.vy + (constants.gravity * constants.frameTime))

			state.hero = hero

			return state
		},
	'killWhenOffscreen':
		state => {
			/*
				check if the player is offscreen,
				and if he or she is append an event.
			*/

			var hero = state.hero

			if (hero.y1 > constants.bounds.y1 || hero.x0 < constants.bounds.x0 ||
				hero.x1 > constants.bounds.x1) {
				state.hero.isDead = true
			}
			state.hero = hero

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

var _update = state => {
	/*
	given the state at t, calculate the state at t + dt
	*/

	var events = [
		react.scrollCloudsLeft,
		react.removeOldClouds,
		react.addClouds,
		react.killWhenOffscreen
	]

	if (state.hero.positionType === 'flying') {

		events = events.concat([react.flyAlong])

	} else {


		if (state.hero.positionType === 'falling') {

			events = events.concat([react.addGravity])

		} else {

			events = events.concat([react.standStill])

		}
		events = events.concat([react.checkOnPlatform])
	}

	state.reactions = state.reactions.concat(events)

	/*
		consume every event in the queue, in order.
	*/

	for (var ith = 0; ith < state.reactions.length; ith++) {
		var reaction = state.reactions[ith]

		if (reaction) {
			state = reaction(state)
		}
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

		ctx.drawImage(birdy, hero.x0, hero.y0)
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
