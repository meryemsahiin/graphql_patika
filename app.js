import { createServer } from 'node:http'
import { createPubSub, createSchema, createYoga, map, pipe, Repeater} from 'graphql-yoga'
import { events, locations, users, participants } from './data.js';
 
const uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

let globalCounter = 0
const pubSub = createPubSub()
 
const yoga = createYoga({
  schema: createSchema({
    typeDefs: /* GraphQL */ `

    # User

  type User {
    id: ID!
    username: String!
    email: String
    events: [Event]!
  }

  input CreateUserInput {
    username: String!
    email: String!
  }

  input UpdateUserInput {
    username: String
    email: String
  }

  # Event

  type Event {
    id: ID!
    title: String!
    desc: String!
    date: String
    from: String!
    to: String!
    location_id: Int!
    location: [Location]!
    user_id: ID!
    users: [User]!
    participants: [Participant!]!
  }

  input CreateEventInput {
    title: String!
    desc: String!
    date: String
    from: String!
    to: String!
    location_id: Int!
    user_id: ID!
  }

  input UpdateEventInput {
    title: String
    desc: String
    date: String
    from: String
    to: String
    location_id: Int
    user_id: ID
  }

  # Location

  type Location {
    id: ID!
    name: String!
    desc: String!
    lat: Float!
    lng: Float!
    events: [Event]!
  }

  input CreateLocationInput {
    name: String!
    desc: String!
    lat: Float!
    lng: Float!
  }

  input UpdateLocationInput {
    name: String!
    desc: String!

  }

  #Participant

  type Participant {
    id: ID!
    user_id: ID!
    event_id: ID!
    user: [User]!
    event: [Event]!
  }

  input CreateParticipantInput {
    user_id: ID!
    event_id: ID!
  }

  input UpdateParticipantInput {
    user_id: ID!
    event_id: ID!

  }

  type DeleteAllOutPut{
    count: Int!
  }

      type Query {
        users: [User!]!
    user(id: ID!): User!

    events: [Event!]!
    event(id: ID!): Event!

    locations: [Location!]!
    location(id: ID!): Location!

    participants: [Participant!]!
    participant(id: ID!): Participant!

      }
 
      type Subscription {
        globalCounter: Int!
        userCreated: User!
      }
 
      type Mutation {
        #User
    createUser(data: CreateUserInput): User!
    updateUser(id: ID!, data: UpdateUserInput): User!
    deleteUser(id: ID!): User!
    deleteAllUsers: DeleteAllOutPut!

    #Event
    createEvent(data: CreateEventInput): Event!
    updateEvent(id: ID!, data: UpdateEventInput): Event!
    deleteEvent(id: ID!): Event!
    deleteAllEvents: DeleteAllOutPut!

    #Location
    createLocation(data: CreateLocationInput): Location!
    updateLocation(id: ID!, data: UpdateLocationInput): Location!
    deleteLocation(id: ID!): Location!
    deleteAllLocations: DeleteAllOutPut!

    #Participant
    createParticipant(data: CreateParticipantInput): Participant!
    updateParticipant(id: ID!, data: UpdateParticipantInput): Participant!
    deleteParticipant(id: ID!): Participant!
    deleteAllParticipants: DeleteAllOutPut!
      }
    `,
    resolvers: {
      Query: {
        users: () => users,
    user: (parent, args) => users.find((user) => user.id == args.id),

    events: () => events,
    event: (parent, args) => events.find((event) => event.id == args.id),

    locations: () => locations,
    location: (parent, args) =>
      locations.find((location) => location.id == args.id),

    participants: () => participants,
    participant: (parent, args) =>
      participants.find((participant) => participant.id == args.id),
      },
      User: {
        events: (parent, args) =>
          events.filter((event) => event.user_id == parent.id),
      },
    
      Event: {
        users: (parent, args) => users.filter((user) => user.id == parent.user_id),
    
        location: (parent, args) =>
          locations.find((location) => location.id == parent.location_id),
    
        participants: (parent, args) =>
          participants.filter(
            (participant) => participant.event_id == parent.event_id
          ),
      },
    
      Location: {
        events: (parent, args) =>
          events.filter((event) => event.location_id == parent.id),
      },     
      Participant: {
        user: (parent, args) => users.find((user) => user.id == parent.user_id),
    
        event: (parent, args) =>
          events.find((event) => event.id == parent.event_id),
      },
      Subscription: {
        // globalCounter: {
        //   // Merge initial value with source stream of new values
        //   subscribe: () =>
        //     pipe(
        //       Repeater.merge([
        //         // cause an initial event so the
        //         // globalCounter is streamed to the client
        //         // upon initiating the subscription
        //         undefined,
        //         // event stream for future updates
        //         pubSub.subscribe('globalCounter:change')
        //       ]),
        //       // map all stream values to the latest globalCounter
        //       map(() => globalCounter)
        //     ),
        //   resolve: payload => payload
        // },
        userCreated: {
            // subscribe: (_, __, {pubSub}) => pubSub.asyncIterator('userCreated'),
            subscribe: (_, __, {pubSub}) => pipe(
              Repeater.merge([undefined, pubSub.subscribe('userCreated:change')]),
              map(() => userCreated)
            ),
            resolve: payload => payload
        },
      },
      Mutation: {
        
    // User
    createUser: (_, { data }, {pubSub}) => {
        const user = {
          id: uid(),
          ...data,
        };
        users.push(user);
        pubSub.publish('userCreated', {user})

        return user;
      },
      updateUser: (parent, { id, data }) => {
        const user_index = users.findIndex((user) => user.id == id);
  
        if (user_index == -1) {
          throw new Error("User not found!");
        }
        const updatedUser = (users[user_index] = {
          ...users[user_index],
          ...data,
        });
        return updatedUser;
      },
      deleteUser: (parent, {id}) => {
          const user_index = users.findIndex(user => user.id == id);
  
          if(user_index == -1) {
              throw new Error("User Not Found!");
          }
          const deletedUser = users[user_index]
          users.splice(user_index, 1);
  
          return deletedUser;
      },
      deleteAllUsers: () => {
          const length = users.length;
          users.splice(0, length);
  
          return {
              count: length,
          };
      },
  
      // Event
      createEvent: (parent, { data }) => {
        const event = { id: uid(), ...data };
        events.push(event);
        return event;
      },
      updateEvent: (parent, { id, data }) => {
        const event_index = events.findIndex((event) => event.id == id);
  
        if (event_index == -1) {
          throw new Error("Event not found!");
        }
        const updatedEvent = (events[event_index] = {
          ...events[event_index],
          ...data,
        });
        return updatedEvent;
      },
      deleteEvent: (parent, {id}) => {
          const event_index = events.findIndex(event => event.id == id);
  
          if(event_index == -1) {
              throw new Error("Event Not Found!");
          }
          const deletedEvent = events[event_index]
          events.splice(event_index, 1);
  
          return deletedEvent;
      },
      deleteAllEvents: () => {
          const length = events.length;
          events.splice(0, length);
  
          return {
              count: length,
          };
      },
  
      // Location
      createLocation: (parent, { data }) => {
          const location = { id: uid(), ...data };
          locations.push(location);
          return location;
      },
      updateLocation: (parent, { id, data }) => {
          const location_index = locations.findIndex((location) => location.id == id);
    
          if (location_index == -1) {
            throw new Error("Location not found!");
          }
          const updatedLocation = (locations[location_index] = {
            ...locations[location_index],
            ...data,
          });
          return updatedLocation;
      },
      deleteLocation: (parent, {id}) => {
          const location_index = locations.findIndex(location => location.id == id);
  
          if(location_index == -1) {
              throw new Error("Location Not Found!");
          }
          const deletedLocation = locations[location_index]
          locations.splice(location_index, 1);
  
          return deletedLocation;
      },
      deleteAllLocations: () => {
          const length = locations.length;
          locations.splice(0, length);
  
          return {
              count: length,
          };
      },
  
      // Participant
      createParticipant: (parent, {data}) => {
          const participant = {id: uid(), ...data};
          participants.push(participant);
          return participant;
      },
      updateParticipant: (parent, {id, data}) => {
          const participant_index = participants.findIndex((participant) => participant.id == id);
  
          if (participant_index == -1) {
              throw new Error("Participant not found!");
          }
          const updatedParticipant = (participants[participant_index] = {
              ...participants[participant_index],
              ...data,
          });
          return updatedParticipant;
      },
      deleteParticipant: (parent, {id}) => {
          const participant_index = participants.findIndex(participant => participant.id == id);
  
          if(participant_index == -1) {
              throw new Error("Participant Not Found!");
          }
          const deleteParticipant = participants[participant_index]
          participants.splice(participant_index, 1);
  
          return deleteParticipant;
      },
      deleteAllParticipants: () => {
          const length = participants.length;
          participants.splice(0, length);
  
          return {
              count: length,
          }
      }
      },
      }
    })
  })

 
const server = createServer(yoga)
server.listen(4000, () => {
  console.info('Server is running on http://localhost:4000/graphql')
})